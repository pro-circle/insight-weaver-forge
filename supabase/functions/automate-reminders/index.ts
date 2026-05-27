// Called by pg_cron on a schedule (recommended: every 5 minutes). Uses the
// SERVICE ROLE key to bypass RLS so it can read every user's profile +
// pending customers and send through each user's own Gmail SMTP.
//
// Auth: requires the shared `x-cron-secret` header (set inside the pg_cron
// job). Without it, returns 401.
//
// Refactor notes (fixes "no logs in dashboard / nothing sent"):
//   1. SMTP uses port 465 + implicit TLS by default. Denomailer's STARTTLS
//      path (port 587, tls:false) frequently throws "invalid cmd" against
//      Gmail and the whole batch dies silently.
//   2. The previous version only fired when `localHHMM(tz) === automation_time`
//      EXACTLY. If pg_cron didn't tick on that exact minute (network jitter,
//      cron set to */5, etc.) the user was skipped for the whole day. We now
//      treat `automation_time` as "earliest send time" and run once per local
//      day per user using `automation_last_run_at` for idempotency.
//   3. Every invocation writes a heartbeat to `activity_logs` (action
//      `automation_cron_tick`) so you can confirm the cron is actually
//      hitting the function from the Supabase dashboard, even when there's
//      nothing to send.
//   4. Per-user / per-customer errors are caught, logged, and counted —
//      they no longer abort the whole run.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Profile {
  id: string;
  name: string | null;
  company_name: string | null;
  timezone: string | null;
  automation_enabled: boolean | null;
  automation_time: string | null; // "HH:MM" or "HH:MM:SS"
  automation_last_run_at: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_app_password: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
}

interface Customer {
  id: string; user_id: string; name: string;
  email: string | null; amount: number; status: string; due_date: string | null;
}

const DEFAULT_SUBJECT = "Payment reminder — ₹{{amount}}";
const DEFAULT_BODY =
  "Hi {{to_name}},\n\nThis is a friendly reminder that your payment of ₹{{amount}} is currently {{status}} (due: {{due_date}}).\n\n— {{from_name}}";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Returns the current local date (YYYY-MM-DD) and time (HH:MM) for `tz`. */
function localParts(tz: string): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Returns the local YYYY-MM-DD of an ISO timestamp in the given tz. */
function localDateOf(iso: string, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function logHeartbeat(sb: SupabaseClient, details: Record<string, unknown>) {
  try {
    await sb.from("activity_logs").insert({
      user_id: null, action: "automation_cron_tick", details,
    });
  } catch (e) {
    console.error("heartbeat log failed", e);
  }
}

async function processUser(sb: SupabaseClient, p: Profile) {
  const tz = p.timezone || "Asia/Kolkata";
  const now = new Date();
  const { date: today, time: nowHHMM } = localParts(tz);
  const scheduled = (p.automation_time || "").slice(0, 5);

  if (!p.smtp_user || !p.smtp_app_password || !scheduled) {
    return { skipped: "missing config" };
  }
  // Already ran today (in user tz)?
  if (p.automation_last_run_at && localDateOf(p.automation_last_run_at, tz) === today) {
    return { skipped: "already ran today" };
  }
  // Not yet time?
  if (nowHHMM < scheduled) {
    return { skipped: `before scheduled (${nowHHMM} < ${scheduled})` };
  }

  const { data: customers, error: custErr } = await sb
    .from("customers")
    .select("id, user_id, name, email, amount, status, due_date")
    .eq("user_id", p.id)
    .neq("status", "paid")
    .not("email", "is", null);

  if (custErr) throw custErr;

  // Always mark as run, even with zero customers, so we don't loop forever.
  await sb.from("profiles").update({ automation_last_run_at: now.toISOString() }).eq("id", p.id);

  if (!customers?.length) {
    await sb.from("activity_logs").insert({
      user_id: p.id, action: "automation_cron_run", details: { sent: 0, failed: 0, reason: "no due customers" },
    });
    return { sent: 0, failed: 0 };
  }

  const fromName = p.company_name || p.name || "Us";
  const port = p.smtp_port || 465;
  const useImplicitTls = port === 465;
  const client = new SMTPClient({
    connection: {
      hostname: p.smtp_host || "smtp.gmail.com",
      port,
      tls: useImplicitTls,
      auth: { username: p.smtp_user, password: p.smtp_app_password.replace(/\s+/g, "") },
    },
  });

  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const c of customers as Customer[]) {
    const vars = {
      to_name: c.name, from_name: fromName, amount: c.amount,
      status: c.status, due_date: c.due_date ?? "—", upi_link: "",
    };
    try {
      const subject = render(p.email_subject_template || DEFAULT_SUBJECT, vars);
      const text = render(p.email_body_template || DEFAULT_BODY, vars);
      await client.send({
        from: `${fromName} <${p.smtp_user}>`,
        to: c.email!,
        subject,
        content: text,
        html: text.replace(/\n/g, "<br/>"),
      });
      await sb.from("notifications_sent").insert({
        user_id: p.id, customer_id: c.id, channel: "email", message: "auto",
      });
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${c.email}: ${msg}`);
      console.error(`[${p.id}] send to ${c.email} failed:`, msg);
    }
  }
  try { await client.close(); } catch { /* noop */ }

  await sb.from("activity_logs").insert({
    user_id: p.id, action: "automation_cron_run",
    details: { sent, failed, errors: errors.slice(0, 5) },
  });
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    console.error("CRON_SECRET env var not set");
    return json(500, { ok: false, error: "CRON_SECRET not configured" });
  }
  if (req.headers.get("x-cron-secret") !== expected) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return json(500, { ok: false, error: "Supabase env vars missing" });
  }
  const sb = createClient(url, key);

  const { data: profiles, error } = await sb
    .from("profiles")
    .select("id, name, company_name, timezone, automation_enabled, automation_time, automation_last_run_at, smtp_host, smtp_port, smtp_user, smtp_app_password, email_subject_template, email_body_template")
    .eq("automation_enabled", true);

  if (error) {
    console.error("profiles query failed:", error.message);
    await logHeartbeat(sb, { error: error.message });
    return json(500, { ok: false, error: error.message });
  }

  const candidates = profiles ?? [];
  console.log(`automate-reminders: ${candidates.length} enabled profile(s)`);

  const summary: Array<{ user: string; sent?: number; failed?: number; skipped?: string; error?: string }> = [];

  for (const p of candidates as Profile[]) {
    try {
      const r = await processUser(sb, p);
      summary.push({ user: p.id, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`processUser(${p.id}) failed:`, msg);
      summary.push({ user: p.id, error: msg });
      try {
        await sb.from("activity_logs").insert({
          user_id: p.id, action: "automation_cron_error", details: { error: msg },
        });
      } catch { /* noop */ }
    }
  }

  await logHeartbeat(sb, {
    enabled_profiles: candidates.length,
    processed: summary.length,
    summary: summary.slice(0, 20),
  });

  return json(200, { ok: true, users: summary.length, summary });
});
