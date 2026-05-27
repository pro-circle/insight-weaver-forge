// Sends an email via the calling user's Gmail SMTP using denomailer.
// Invoked from the browser with the user's bearer token; SMTP credentials
// come from the request body.
//
// CORS hardening: EVERY response path (preflight, success, validation error,
// SMTP failure, and unexpected runtime crash) returns the shared corsHeaders.
// If even one path is missed, the browser surfaces a generic
// "Missing Access-Control-Allow-Origin" error with no useful detail.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Body {
  smtp: { host?: string; port?: number; user: string; password: string };
  from_name?: string;
  to_email: string;
  subject: string;
  text: string;
  html?: string;
}

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  // Preflight — must return CORS headers with a 2xx status.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let body: Body;
  try {
    const raw = await req.text();
    body = JSON.parse(raw || "{}") as Body;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  if (!body?.smtp?.user || !body?.smtp?.password) {
    return json(400, { ok: false, error: "SMTP credentials missing" });
  }
  if (!body.to_email || !body.subject) {
    return json(400, { ok: false, error: "Recipient and subject required" });
  }

  let client: SMTPClient | null = null;
  try {
    // Gmail + denomailer is most reliable on 465 (implicit TLS).
    // Port 587 (STARTTLS) frequently throws "invalid cmd" with this lib.
    const port = body.smtp.port || 465;
    const useImplicitTls = port === 465;
    client = new SMTPClient({
      connection: {
        hostname: body.smtp.host || "smtp.gmail.com",
        port,
        tls: useImplicitTls,
        auth: {
          username: body.smtp.user,
          password: body.smtp.password.replace(/\s+/g, ""),
        },
      },
    });


    await client.send({
      from: `${body.from_name || body.smtp.user} <${body.smtp.user}>`,
      to: body.to_email,
      subject: body.subject,
      content: body.text,
      html: body.html ?? body.text.replace(/\n/g, "<br/>"),
    });

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-email failed:", msg);
    return json(400, { ok: false, error: msg });
  } finally {
    try { await client?.close(); } catch { /* noop */ }
  }
});
