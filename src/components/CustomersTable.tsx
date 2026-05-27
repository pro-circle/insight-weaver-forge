import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowDown, ArrowUp, Mail, MessageCircle, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Customer, Profile } from "./UserCard";
import { buildUpiLink, sendReminderEmail, whatsappLink, smsLink } from "@/lib/notify";
import {
  renderTemplate, isValidPhone,
  DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT, DEFAULT_SMS, DEFAULT_WHATSAPP,
} from "@/lib/templates";
import { supabase, logActivity } from "@/lib/supabase";

/**
 * Tabular customer view with sort + inline Email/WhatsApp/SMS actions.
 * Mirrors the card actions so users who prefer the table can act without
 * switching tabs.
 */
export function CustomersTable({
  customers, profile, fromName,
}: {
  customers: Customer[];
  profile: Profile;
  fromName: string;
}) {
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...customers].sort((a, b) => dir === "asc" ? a.amount - b.amount : b.amount - a.amount),
    [customers, dir],
  );

  function toneClass(s: string) {
    if (s === "paid") return "bg-green-600 text-white";
    if (s === "pending") return "bg-yellow-500 text-black";
    return "bg-red-600 text-white";
  }

  function buildVars(c: Customer) {
    const upiLink = profile.enable_upi && profile.upi_id && profile.payee_name && c.amount > 0
      ? buildUpiLink({
          upiId: profile.upi_id, payeeName: profile.payee_name,
          amount: c.amount, note: `Payment from ${c.name}`,
        })
      : "";
    return {
      to_name: c.name, from_name: fromName, amount: c.amount,
      status: c.status, due_date: c.due_date ?? "—", upi_link: upiLink,
    };
  }

  async function emailRow(c: Customer) {
    if (!c.email) return toast.error("No email on file");
    if (!profile.smtp_user || !profile.smtp_app_password) return toast.error("Configure Gmail SMTP first");
    setSendingId(c.id);
    try {
      const vars = buildVars(c);
      await sendReminderEmail({
        smtp: {
          host: profile.smtp_host, port: profile.smtp_port,
          user: profile.smtp_user, password: profile.smtp_app_password,
        },
        from_name: fromName,
        to_email: c.email,
        subject: renderTemplate(profile.email_subject_template || DEFAULT_EMAIL_SUBJECT, vars),
        body:    renderTemplate(profile.email_body_template    || DEFAULT_EMAIL_BODY,    vars),
      });
      const { data } = await supabase.auth.getUser();
      await supabase.from("notifications_sent").insert({
        user_id: data.user!.id, customer_id: c.id, channel: "email", message: "table row",
      });
      logActivity("notify_sent", { channel: "email", customer_id: c.id, source: "table" });
      toast.success(`📧 Email sent to ${c.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email failed");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-3">
          <p className="text-sm font-medium">Customers sorted by amount</p>
          <Button variant="outline" size="sm" className="hover:bg-blue-700 hover:text-white"
            onClick={() => setDir(dir === "asc" ? "desc" : "asc")}>
            {dir === "asc"
              ? <><ArrowUp className="mr-1 h-3 w-3" /> Low → High</>
              : <><ArrowDown className="mr-1 h-3 w-3" /> High → Low</>}
            <ArrowUpDown className="ml-2 h-3 w-3 opacity-60" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2 text-right">Notify</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const vars = buildVars(c);
                const waMsg  = renderTemplate(profile.whatsapp_template || DEFAULT_WHATSAPP, vars);
                const smsMsg = renderTemplate(profile.sms_template      || DEFAULT_SMS,      vars);
                const phoneOk = isValidPhone(c.phone);
                return (
                  <tr key={c.id} className="border-t hover:bg-blue-50/40">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">₹{Number(c.amount).toLocaleString()}</td>
                    <td className="px-4 py-2"><Badge className={toneClass(c.status)}>{c.status}</Badge></td>
                    <td className="px-4 py-2 text-xs">{c.due_date || "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 hover:bg-blue-700 hover:text-white"
                          disabled={!c.email || sendingId === c.id}
                          onClick={() => emailRow(c)}
                          title="Send email"
                        >
                          {sendingId === c.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Mail className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm" variant="outline" asChild disabled={!phoneOk}
                          className="h-7 px-2 hover:bg-blue-700 hover:text-white"
                          title="Open WhatsApp"
                        >
                          <a
                            href={phoneOk ? whatsappLink(c.phone!, waMsg) : "#"}
                            target="_blank" rel="noreferrer"
                            onClick={(e) => { if (!phoneOk) { e.preventDefault(); toast.error("Invalid mobile number"); } }}
                          ><MessageCircle className="h-3.5 w-3.5" /></a>
                        </Button>
                        <Button
                          size="sm" variant="outline" asChild disabled={!phoneOk}
                          className="h-7 px-2 hover:bg-blue-700 hover:text-white"
                          title="Open SMS"
                        >
                          <a
                            href={phoneOk ? smsLink(c.phone!, smsMsg) : "#"}
                            onClick={(e) => { if (!phoneOk) { e.preventDefault(); toast.error("Invalid mobile number"); } }}
                          ><Phone className="h-3.5 w-3.5" /></a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No customers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
