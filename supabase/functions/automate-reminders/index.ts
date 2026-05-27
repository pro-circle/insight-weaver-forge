// Called by pg_cron every minute. Uses SERVICE ROLE to bypass RLS so it can
// read all users' profiles + pending customers and send through each user's
// own Gmail SMTP. Authenticated via a shared CRON_SECRET in the
// `x-cron-secret` header (set inside the pg_cron job).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface Profile {
  id: string;
  name: string | null;
  company_name: string | null;
  timezone: string | null;
  automation_enabled: boolean | null;
  automation_time: string | null; // "HH:MM"
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

function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

function localHHMM(tz: string): string {
  // Returns "HH:MM" in the requested IANA timezone, 24-hour.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
  return fmt.format(new Date());
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, name, company_name, timezone, automation_enabled, automation_time, automation_last_run_at, smtp_host, smtp_port, smtp_user, smtp_app_password, email_subject_template, email_body_template")
    .eq("automation_enabled", true);

  if (!profiles?.length) return new Response(JSON.stringify({ ok: true, users: 0 }));

  const summary: Array<{ user: string; sent: number; failed: number }> = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  for (const p of profiles as Profile[]) {
    if (!p.smtp_user || !p.smtp_app_password || !p.automation_time) continue;
    const tz = p.timezone || "Asia/Kolkata";
    if (localHHMM(tz) !== p.automation_time.slice(0, 5)) continue;
    // Idempotency: skip if already run today (in user tz).
    if (p.automation_last_run_at && p.automation_last_run_at.slice(0, 10) === today) continue;

    const { data: customers } = await sb
      .from("customers")
      .select("id, user_id, name, email, amount, status, due_date")
      .eq("user_id", p.id)
      .neq("status", "paid")
      .not("email", "is", null);

    if (!customers?.length) {
      await sb.from("profiles").update({ automation_last_run_at: now.toISOString() }).eq("id", p.id);
      continue;
    }

    const fromName = p.company_name || p.name || "Us";
    const client = new SMTPClient({
      connection: {
        hostname: p.smtp_host || "smtp.gmail.com",
        port: p.smtp_port || 587,
        tls: false,
        auth: { username: p.smtp_user, password: p.smtp_app_password.replace(/\s+/g, "") },
      },
    });

    let sent = 0, failed = 0;
    for (const c of customers as Customer[]) {
      const vars = {
        to_name: c.name, from_name: fromName, amount: c.amount,
        status: c.status, due_date: c.due_date ?? "—", upi_link: "",
      };
      try {
        await client.send({
          from: `${fromName} <${p.smtp_user}>`,
          to: c.email!,
          subject: render(p.email_subject_template || DEFAULT_SUBJECT, vars),
          content: render(p.email_body_template || DEFAULT_BODY, vars),
          html: render(p.email_body_template || DEFAULT_BODY, vars).replace(/\n/g, "<br/>"),
        });
        await sb.from("notifications_sent").insert({
          user_id: p.id, customer_id: c.id, channel: "email", message: "auto",
        });
        sent++;
      } catch { failed++; }
    }
    try { await client.close(); } catch { /* noop */ }

    await sb.from("profiles").update({ automation_last_run_at: now.toISOString() }).eq("id", p.id);
    await sb.from("activity_logs").insert({
      user_id: p.id, action: "automation_cron_run", details: { sent, failed },
    });
    summary.push({ user: p.id, sent, failed });
  }

  return new Response(JSON.stringify({ ok: true, users: summary.length, summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
