// Notification helpers.
// • Email goes through Supabase Edge Function `send-email` (denomailer + user's Gmail SMTP).
// • Contact-Developer goes through Edge Function `contact-developer` (EmailJS REST).
// • WhatsApp / SMS are deep links (opened from the browser).
import { supabase } from "@/lib/supabase";

function getFunctionUrl(name: string) {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("Supabase URL is not configured.");
  return `${baseUrl}/functions/v1/${name}`;
}

async function invokePublicFunction<T>(name: string, body: unknown) {
  const response = await fetch(getFunctionUrl(name), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let data: T | null = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as T;
    } catch {
      throw new Error(response.ok ? "Unexpected function response" : raw);
    }
  }

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error ?? `Request failed (${response.status})`)
        : `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  return data;
}

// ============== UPI deep-link ==============
export function buildUpiLink(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}) {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: String(opts.amount),
    cu: "INR",
    tn: opts.note ?? "Payment",
  });
  return `upi://pay?${params.toString()}`;
}

// ============== Gmail SMTP via edge function ==============
export interface SmtpCreds {
  host?: string | null;
  port?: number | null;
  user?: string | null;
  password?: string | null;
}

export async function sendReminderEmail(opts: {
  smtp: SmtpCreds;
  from_name: string;
  to_email: string;
  subject: string;
  body: string;
}) {
  if (!opts.smtp.user || !opts.smtp.password) {
    throw new Error("Gmail SMTP not configured. Open Settings → SMTP.");
  }
  const data = await invokePublicFunction<{ ok: boolean; error?: string }>("send-email", {
    smtp: {
      host: opts.smtp.host || "smtp.gmail.com",
      port: opts.smtp.port || 465,
      user: opts.smtp.user,
      password: String(opts.smtp.password).replace(/\s+/g, ""),
    },
    from_name: opts.from_name,
    to_email: opts.to_email,
    subject: opts.subject,
    text: opts.body,
  });
  if (!data?.ok) throw new Error(data?.error || "SMTP send failed");
  return data;
}

// ============== Contact Developer (server-proxied EmailJS) ==============
export async function sendContactDeveloper(payload: {
  name: string;
  user_email: string;
  user_message: string;
}) {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
    "contact-developer",
    {
      body: payload,
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Failed to send");
  return data;
}

// ============== WhatsApp / SMS deep-links ==============
export function whatsappLink(phone: string, message: string) {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string, message: string) {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}
