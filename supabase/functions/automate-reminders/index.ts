// Called by pg_cron every minute. The function now uses a small database
// queue instead of trying to do the whole daily automation as one brittle
// synchronous pass:
//   1. Find users whose local scheduled time has passed today.
//   2. Enqueue one idempotent email job per unpaid customer per local day.
//   3. Process a small batch of queued jobs with retries and detailed logs.
//
// This fixes the common "manual run works but automatic mail does not" case
// where an old automation_last_run_at value, a missed exact cron minute, or a
// single SMTP failure prevents the rest of the automation from being visible.

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
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  amount: number;
  status: string;
  due_date: string | null;
}

interface EmailJob {
  id: string;
  user_id: string;
  customer_id: string | null;
  recipient: string;
  subject: string;
  body: string;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string;
  smtp_app_password: string;
  attempts: number;
}

const DEFAULT_SUBJECT = "Payment reminder — ₹{{amount}}";
const DEFAULT_BODY =
  "Hi {{to_name}},\n\nThis is a friendly reminder that your payment of ₹{{amount}} is currently {{status}} (due: {{due_date}}).\n\n— {{from_name}}";
const MAX_ATTEMPTS = 3;
const PROCESS_LIMIT = 8;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Returns the current local date (YYYY-MM-DD) and time (HH:MM) for `tz`. */
function localParts(tz: string): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function logHeartbeat(sb: SupabaseClient, details: Record<string, unknown>) {
  try {
    await sb.from("activity_logs").insert({
      user_id: null,
      action: "automation_cron_tick",
      details,
    });
  } catch (e) {
    console.error("heartbeat log failed", e);
  }
}

async function enqueueUserJobs(sb: SupabaseClient, p: Profile) {
  const tz = p.timezone || "Asia/Kolkata";
  const now = new Date();
  const { date: today, time: nowHHMM } = localParts(tz);
  const scheduled = (p.automation_time || "").slice(0, 5);

  if (!p.smtp_user || !p.smtp_app_password || !scheduled) {
    return { skipped: "missing config" };
  }
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

  if (!customers?.length) {
    await sb.from("activity_logs").insert({
      user_id: p.id,
      action: "automation_cron_enqueue",
      details: { queued: 0, reason: "no due customers", local_date: today },
    });
    await sb.from("profiles").update({ automation_last_run_at: now.toISOString() }).eq("id", p.id);
    return { queued: 0 };
  }

  const fromName = p.company_name || p.name || "Us";
  const jobs = (customers as Customer[]).map((c) => {
    const vars = {
      to_name: c.name,
      from_name: fromName,
      amount: c.amount,
      status: c.status,
      due_date: c.due_date ?? "—",
      upi_link: "",
    };
    return {
      user_id: p.id,
      customer_id: c.id,
      recipient: c.email!,
      subject: render(p.email_subject_template || DEFAULT_SUBJECT, vars),
      body: render(p.email_body_template || DEFAULT_BODY, vars),
      from_name: fromName,
      smtp_host: p.smtp_host || "smtp.gmail.com",
      smtp_port: p.smtp_port || 465,
      smtp_user: p.smtp_user!,
      smtp_app_password: p.smtp_app_password!.replace(/\s+/g, ""),
      status: "pending",
      idempotency_key: `${p.id}:${c.id}:${today}`,
      scheduled_for: now.toISOString(),
      updated_at: now.toISOString(),
    };
  });

  const { error: queueErr } = await sb
    .from("email_queue")
    .upsert(jobs, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (queueErr) throw queueErr;

  await sb.from("profiles").update({ automation_last_run_at: now.toISOString() }).eq("id", p.id);
  await sb.from("activity_logs").insert({
    user_id: p.id,
    action: "automation_cron_enqueue",
    details: { queued_attempted: jobs.length, local_date: today, scheduled, timezone: tz },
  });
  return { queued: jobs.length };
}

function nextRetryIso(attempts: number) {
  return new Date(Date.now() + Math.min(30, attempts * 5) * 60_000).toISOString();
}

async function processQueuedEmails(sb: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await sb
    .from("email_queue")
    .select(
      "id, user_id, customer_id, recipient, subject, body, from_name, smtp_host, smtp_port, smtp_user, smtp_app_password, attempts",
    )
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(PROCESS_LIMIT);

  if (error) throw error;

  let sent = 0,
    failed = 0;
  const errors: string[] = [];

  for (const job of (jobs ?? []) as EmailJob[]) {
    const attempt = (job.attempts || 0) + 1;
    await sb
      .from("email_queue")
      .update({
        status: "processing",
        attempts: attempt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending");

    let client: SMTPClient | null = null;
    try {
      const port = job.smtp_port || 465;
      client = new SMTPClient({
        connection: {
          hostname: job.smtp_host || "smtp.gmail.com",
          port,
          tls: port === 465,
          auth: { username: job.smtp_user, password: job.smtp_app_password.replace(/\s+/g, "") },
        },
      });

      await client.send({
        from: `${job.from_name || job.smtp_user} <${job.smtp_user}>`,
        to: job.recipient,
        subject: job.subject,
        content: job.body,
        html: job.body.replace(/\n/g, "<br/>"),
      });

      await sb
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      await sb.from("notifications_sent").insert({
        user_id: job.user_id,
        customer_id: job.customer_id,
        channel: "email",
        message: "auto",
      });
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${job.recipient}: ${msg}`);
      console.error(`[${job.user_id}] queued send to ${job.recipient} failed:`, msg);
      await sb
        .from("email_queue")
        .update({
          status: attempt >= MAX_ATTEMPTS ? "failed" : "pending",
          last_error: msg,
          scheduled_for: attempt >= MAX_ATTEMPTS ? nowIso : nextRetryIso(attempt),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await sb.from("activity_logs").insert({
        user_id: job.user_id,
        action: "automation_email_error",
        details: { recipient: job.recipient, attempt, error: msg },
      });
    } finally {
      try {
        await client?.close();
      } catch {
        /* noop */
      }
    }
  }

  return { picked: jobs?.length ?? 0, sent, failed, errors: errors.slice(0, 5) };
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
    .select(
      "id, name, company_name, timezone, automation_enabled, automation_time, automation_last_run_at, smtp_host, smtp_port, smtp_user, smtp_app_password, email_subject_template, email_body_template",
    )
    .eq("automation_enabled", true);

  if (error) {
    console.error("profiles query failed:", error.message);
    await logHeartbeat(sb, { error: error.message });
    return json(500, { ok: false, error: error.message });
  }

  const candidates = profiles ?? [];
  console.log(`automate-reminders: ${candidates.length} enabled profile(s)`);

  const summary: Array<{ user: string; queued?: number; skipped?: string; error?: string }> = [];

  for (const p of candidates as Profile[]) {
    try {
      const r = await enqueueUserJobs(sb, p);
      summary.push({ user: p.id, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`enqueueUserJobs(${p.id}) failed:`, msg);
      summary.push({ user: p.id, error: msg });
      try {
        await sb.from("activity_logs").insert({
          user_id: p.id,
          action: "automation_cron_error",
          details: { error: msg },
        });
      } catch {
        /* noop */
      }
    }
  }

  let processed = { picked: 0, sent: 0, failed: 0, errors: [] as string[] };
  try {
    processed = await processQueuedEmails(sb);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processQueuedEmails failed:", msg);
    await logHeartbeat(sb, { queue_error: msg });
  }

  await logHeartbeat(sb, {
    enabled_profiles: candidates.length,
    enqueued_profiles: summary.length,
    processed,
    summary: summary.slice(0, 20),
  });

  return json(200, { ok: true, users: summary.length, summary, processed });
});
