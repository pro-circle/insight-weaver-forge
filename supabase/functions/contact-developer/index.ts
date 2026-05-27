// Server-proxied EmailJS — uses the PRIVATE key so non-browser origins are allowed.
// Keeps EmailJS keys out of the browser bundle.
import { corsHeaders } from "../_shared/cors.ts";

interface Body { name: string; user_email: string; user_message: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = (await req.json()) as Body;
    if (!b.user_message?.trim()) throw new Error("Message is required");
    if (b.user_message.length > 2000) throw new Error("Message too long (max 2000)");

    const service = Deno.env.get("EMAILJS_SERVICE_ID")!;
    const template = Deno.env.get("EMAILJS_CONTACT_TEMPLATE_ID")!;
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY")!;
    if (!service || !template || !publicKey || !privateKey) {
      throw new Error("Contact form not configured (EmailJS env keys missing).");
    }

    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: service,
        template_id: template,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          name: b.name || "Anonymous",
          user_email: b.user_email || "no-reply@example.com",
          user_message: b.user_message,
        },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`EmailJS ${r.status}: ${t.slice(0, 200)}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
