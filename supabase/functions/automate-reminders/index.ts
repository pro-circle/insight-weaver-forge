// Called by pg_cron every minute. The scheduled worker intentionally mirrors
// the manual "Run now" path: once a user's local scheduled time has passed, it
// sends reminders directly through the same Gmail SMTP settings, writes one
// activity log with exact skip/send/error details, and marks the profile as run
// only after that due window is evaluated.

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Profile {
  id: string;
  name: string | null;
  company_name: string | null;
  timezone: string | null;
  automation_enabled: boolean | null;
  automation_time: string | null;
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

interface AutomationResult {
  user: string;
  sent: number;
  failed: number;
  skipped?: string;
  error?: string;
  errors?: string[];
  details?: Record<string, unknown>;
}

const DEFAULT_SUBJECT = "Payment reminder — ₹{{amount}}";
const DEFAULT_BODY =
  "Hi {{to_name}},\n\nThis is a friendly reminder that your payment of ₹{{amount}} is currently {{status}} (due: {{due_date}}).\n\n— {{from_name}}";
const SEND_LIMIT_PER_USER = 25;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

function normalizeTime(value: string | null) {
  const match = (value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localParts(tz: string): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: tz,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function localDateOf(iso: string, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function safeLog(
  sb: SupabaseClient,
  userId: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  try {
    await sb.from("activity_logs").insert({ user_id: userId, action, details });
  } catch (e) {
    console.error(`${action} log failed`, e);
  }
}

async function sendSmtpEmail(opts: {
  host: string;
  port: number;
  user: string;
  password: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
}) {
  let client: SMTPClient | null = null;
  try {
    const port = opts.port || 465;
    client = new SMTPClient({
      connection: {
        hostname: opts.host || "smtp.gmail.com",
        port,
        tls: port === 465,
        auth: {
          username: opts.user,
          password: opts.password.replace(/\s+/g, ""),
        },
      },
    });

    await client.send({
      from: `${opts.fromName || opts.user} <${opts.user}>`,
      to: opts.to,
      subject: opts.subject,
      content: opts.body,
      html: opts.body.replace(/\n/g, "<br/>"),
    });
  } finally {
    try {
      await client?.close();
    } catch {
      /* noop */
    }
  }
}

async function runProfileAutomation(sb: SupabaseClient, p: Profile) {
  const tz = p.timezone || "Asia/Kolkata";
  const { date: today, time: nowHHMM } = localParts(tz);
  const scheduled = normalizeTime(p.automation_time);
  const lastRunLocalDate = p.automation_last_run_at
    ? localDateOf(p.automation_last_run_at, tz)
    : null;

  const baseDetails = {
    local_date: today,
    local_time: nowHHMM,
    scheduled,
    timezone: tz,
    last_run_local_date: lastRunLocalDate,
  };

  if (!scheduled) {
    console.log(`[${p.id}] automation skipped: missing schedule`, baseDetails);
    await safeLog(sb, p.id, "automation_cron_skip", {
      ...baseDetails,
      reason: "missing schedule",
    });
    return {
      user: p.id,
      sent: 0,
      failed: 0,
      skipped: "missing schedule",
      details: baseDetails,
    };
  }

  if (!p.smtp_user || !p.smtp_app_password) {
    console.log(`[${p.id}] automation skipped: missing SMTP`, baseDetails);
    await safeLog(sb, p.id, "automation_cron_skip", {
      ...baseDetails,
      reason: "missing SMTP",
    });
    return {
      user: p.id,
      sent: 0,
      failed: 0,
      skipped: "missing SMTP",
      details: baseDetails,
    };
  }

  if (lastRunLocalDate === today) {
    console.log(`[${p.id}] automation skipped: already ran today`, baseDetails);
    await safeLog(sb, p.id, "automation_cron_skip", {
      ...baseDetails,
      reason: "already ran today",
    });
    return {
      user: p.id,
      sent: 0,
      failed: 0,
      skipped: "already ran today",
      details: baseDetails,
    };
  }

  if (nowHHMM < scheduled) {
    console.log(
      `[${p.id}] automation skipped: before scheduled time`,
      baseDetails,
    );
    await safeLog(sb, p.id, "automation_cron_skip", {
      ...baseDetails,
      reason: "before scheduled time",
    });
    return {
      user: p.id,
      sent: 0,
      failed: 0,
      skipped: "before scheduled time",
      details: baseDetails,
    };
  }

  const { data: customers, error: custErr } = await sb
    .from("customers")
    .select("id, user_id, name, email, amount, status, due_date")
    .eq("user_id", p.id)
    .neq("status", "paid")
    .not("email", "is", null)
    .limit(SEND_LIMIT_PER_USER);

  if (custErr) throw custErr;

  const dueCustomers = (customers ?? []) as Customer[];
  if (!dueCustomers.length) {
    await sb.from("profiles").update({
      automation_last_run_at: new Date().toISOString(),
    }).eq("id", p.id);
    console.log(
      `[${p.id}] automation complete: no unpaid customers with email`,
      baseDetails,
    );
    await safeLog(sb, p.id, "automation_cron_complete", {
      ...baseDetails,
      sent: 0,
      failed: 0,
      reason: "no unpaid customers with email",
    });
    return {
      user: p.id,
      sent: 0,
      failed: 0,
      skipped: "no unpaid customers with email",
      details: baseDetails,
    };
  }

  const fromName = p.company_name || p.name || "Us";
  const smtpHost = p.smtp_host || "smtp.gmail.com";
  const smtpPort = p.smtp_port || 465;
  const smtpPassword = p.smtp_app_password.replace(/\s+/g, "");
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const c of dueCustomers) {
    const vars = {
      to_name: c.name,
      from_name: fromName,
      amount: c.amount,
      status: c.status,
      due_date: c.due_date ?? "—",
      upi_link: "",
    };

    try {
      await sendSmtpEmail({
        host: smtpHost,
        port: smtpPort,
        user: p.smtp_user,
        password: smtpPassword,
        fromName,
        to: c.email!,
        subject: render(p.email_subject_template || DEFAULT_SUBJECT, vars),
        body: render(p.email_body_template || DEFAULT_BODY, vars),
      });
      await sb.from("notifications_sent").insert({
        user_id: p.id,
        customer_id: c.id,
        channel: "email",
        message: "auto",
      });
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${c.email}: ${msg}`);
      console.error(`[${p.id}] automatic send to ${c.email} failed:`, msg);
    }
  }

  await sb.from("profiles").update({
    automation_last_run_at: new Date().toISOString(),
  }).eq("id", p.id);
  console.log(`[${p.id}] automation complete: sent ${sent}, failed ${failed}`, {
    ...baseDetails,
    total_due: dueCustomers.length,
    errors: errors.slice(0, 5),
  });
  await safeLog(sb, p.id, "automation_cron_complete", {
    ...baseDetails,
    total_due: dueCustomers.length,
    sent,
    failed,
    errors: errors.slice(0, 10),
  });

  return {
    user: p.id,
    sent,
    failed,
    errors: errors.slice(0, 5),
    details: baseDetails,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
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
    await safeLog(sb, null, "automation_cron_tick", { error: error.message });
    return json(500, { ok: false, error: error.message });
  }

  const enabledProfiles = (profiles ?? []) as Profile[];
  const summary: AutomationResult[] = [];

  for (const profile of enabledProfiles) {
    try {
      summary.push(await runProfileAutomation(sb, profile));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`automation for ${profile.id} failed:`, msg);
      await safeLog(sb, profile.id, "automation_cron_error", { error: msg });
      summary.push({ user: profile.id, sent: 0, failed: 1, error: msg });
    }
  }

  const totals = summary.reduce(
    (acc, item) => ({
      sent: acc.sent +
        ("sent" in item && typeof item.sent === "number" ? item.sent : 0),
      failed: acc.failed +
        ("failed" in item && typeof item.failed === "number" ? item.failed : 0),
      skipped: acc.skipped + ("skipped" in item ? 1 : 0),
    }),
    { sent: 0, failed: 0, skipped: 0 },
  );

  await safeLog(sb, null, "automation_cron_tick", {
    enabled_profiles: enabledProfiles.length,
    totals,
    summary: summary.slice(0, 20),
  });

  return json(200, {
    ok: true,
    enabled_profiles: enabledProfiles.length,
    totals,
    summary,
  });
});
