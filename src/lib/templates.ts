// Editable message templates. Variables use {{double_braces}}.
// Available variables: {{to_name}}, {{from_name}}, {{amount}}, {{status}},
// {{due_date}}, {{upi_link}}.
// The UPI link is built dynamically per-customer and already includes the
// outstanding amount, so the message reads "Click here to pay now → <link>".

export const DEFAULT_EMAIL_SUBJECT = "Payment reminder — ₹{{amount}}";

export const DEFAULT_EMAIL_BODY =
`Hi {{to_name}},

This is a friendly reminder that your payment of ₹{{amount}} is currently {{status}} (due: {{due_date}}).

Click here to pay now: {{upi_link}}

— {{from_name}}`;

export const DEFAULT_WHATSAPP =
`Hi {{to_name}}, friendly reminder: ₹{{amount}} is {{status}}. Click here to pay now: {{upi_link}}`;

export const DEFAULT_SMS =
`Hi {{to_name}}, ₹{{amount}} is {{status}}. Click here to pay now: {{upi_link}}`;

export const TEMPLATE_VARS = [
  "to_name", "from_name", "amount", "status", "due_date", "upi_link",
];

export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? "" : String(v);
  });
}

// Phone validation: digits, optional +, total 10–15 digits.
export function isValidPhone(p: string | null | undefined): boolean {
  if (!p) return false;
  const digits = p.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}
