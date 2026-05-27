// Sends an email via the calling user's Gmail SMTP using denomailer.
// Invoked from the browser with the user's bearer token; we read SMTP
// credentials from the request body (never trust client-side state alone —
// the function also enforces the password is non-empty and the From email
// matches the SMTP user).
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Body {
  smtp: { host: string; port: number; user: string; password: string };
  from_name: string;
  to_email: string;
  subject: string;
  text: string;
  html?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody || "{}") as Body;
    if (!body?.smtp?.user || !body?.smtp?.password) throw new Error("SMTP credentials missing");
    if (!body.to_email || !body.subject) throw new Error("Recipient and subject required");

    const client = new SMTPClient({
      connection: {
        hostname: body.smtp.host || "smtp.gmail.com",
        port: body.smtp.port || 587,
        tls: false,
        auth: { username: body.smtp.user, password: body.smtp.password.replace(/\s+/g, "") },
      },
    });

    await client.send({
      from: `${body.from_name} <${body.smtp.user}>`,
      to: body.to_email,
      subject: body.subject,
      content: body.text,
      html: body.html ?? body.text.replace(/\n/g, "<br/>"),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
