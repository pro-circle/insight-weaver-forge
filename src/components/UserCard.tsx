import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, Sparkles, Trash2, Loader2, RefreshCw } from "lucide-react";
import { supabase, logActivity } from "@/lib/supabase";
import { getInsight } from "@/lib/ai";
import { buildUpiLink, sendReminderEmail, whatsappLink, smsLink } from "@/lib/notify";
import { renderTemplate, isValidPhone, DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT, DEFAULT_SMS, DEFAULT_WHATSAPP } from "@/lib/templates";
import { ConfirmDialog } from "./ConfirmDialog";

export interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  amount: number; status: "paid" | "pending" | "overdue"; due_date: string | null;
  ai_insight?: string | null;
}

export interface Profile {
  name: string | null; company_name: string | null;
  upi_id: string | null; payee_name: string | null; enable_upi: boolean;
  smtp_host: string | null; smtp_port: number | null;
  smtp_user: string | null; smtp_app_password: string | null;
  email_subject_template: string | null; email_body_template: string | null;
  whatsapp_template: string | null; sms_template: string | null;
  automation_enabled: boolean | null; automation_time: string | null;
}

export function UserCard({
  customer, profile, fromName, onDeleted,
}: {
  customer: Customer; profile: Profile; fromName: string; onDeleted: () => void;
}) {
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);

  const upiLink = profile.enable_upi && profile.upi_id && profile.payee_name && customer.amount > 0
    ? buildUpiLink({
        upiId: profile.upi_id, payeeName: profile.payee_name,
        amount: customer.amount, note: `Payment from ${customer.name}`,
      })
    : "";

  const vars = {
    to_name: customer.name, from_name: fromName, amount: customer.amount,
    status: customer.status, due_date: customer.due_date ?? "—", upi_link: upiLink,
  };

  const waMsg = renderTemplate(profile.whatsapp_template || DEFAULT_WHATSAPP, vars);
  const smsMsg = renderTemplate(profile.sms_template || DEFAULT_SMS, vars);
  const emailSubject = renderTemplate(profile.email_subject_template || DEFAULT_EMAIL_SUBJECT, vars);
  const emailBody = renderTemplate(profile.email_body_template || DEFAULT_EMAIL_BODY, vars);

  const phoneOk = isValidPhone(customer.phone);

  async function loadInsight(force = false) {
    setLoadingInsight(true);
    try {
      const r = await getInsight({
        customerId: customer.id,
        name: customer.name, amount: customer.amount, status: customer.status, due_date: customer.due_date,
        force,
      });
      setInsight(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI insight failed");
    } finally {
      setLoadingInsight(false);
      logActivity("ai_insight", { customer_id: customer.id, force });
    }
  }
  useEffect(() => {
    // Use cached value from DB if present (survives reload / re-login).
    if (customer.ai_insight) { setInsight(customer.ai_insight); return; }
    loadInsight(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  async function emailReminder() {
    if (!customer.email) return toast.error("No email on file");
    if (!profile.smtp_user || !profile.smtp_app_password) {
      return toast.error("Configure Gmail SMTP in Settings first");
    }
    setSendingMail(true);
    try {
      await sendReminderEmail({
        smtp: {
          host: profile.smtp_host, port: profile.smtp_port,
          user: profile.smtp_user, password: profile.smtp_app_password,
        },
        from_name: fromName,
        to_email: customer.email,
        subject: emailSubject,
        body: emailBody,
      });
      await supabase.from("notifications_sent").insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        customer_id: customer.id, channel: "email", status: "sent", message: emailBody,
      });
      logActivity("notify_sent", { channel: "email", customer_id: customer.id });
      toast.success(`📧 Email sent to ${customer.name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Email failed";
      try {
        const u = (await supabase.auth.getUser()).data.user;
        if (u) {
          await supabase.from("notifications_sent").insert({
            user_id: u.id, customer_id: customer.id, channel: "email",
            status: "failed", message: msg,
          });
        }
      } catch { /* noop */ }
      toast.error(msg);
    } finally {
      setSendingMail(false);
    }
  }

  async function trackLink(channel: "whatsapp" | "sms", msg: string) {
    await supabase.from("notifications_sent").insert({
      user_id: (await supabase.auth.getUser()).data.user!.id,
      customer_id: customer.id, channel, message: msg,
    });
    logActivity("notify_sent", { channel, customer_id: customer.id });
    toast.success(channel === "whatsapp" ? "💬 WhatsApp opened" : "📱 SMS opened");
  }

  async function remove() {
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onDeleted();
  }

  const statusColor = customer.status === "paid"
    ? "bg-green-600 text-white"
    : customer.status === "pending"
    ? "bg-yellow-500 text-black"
    : "bg-red-600 text-white";

  return (
    <Card className="overflow-hidden transition-colors hover:border-green-600">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{customer.name}</h3>
            <p className="text-sm text-muted-foreground">
              {customer.phone || "no phone"}{customer.phone && !phoneOk && <span className="ml-1 text-red-600">(invalid)</span>}
              {" "}• {customer.email || "no email"}
            </p>
          </div>
          <Badge className={statusColor}>{customer.status}</Badge>
        </div>

        <div className="flex items-baseline justify-between rounded-lg bg-secondary/50 p-3">
          <span className="text-xs text-muted-foreground">Amount</span>
          <span className="text-xl font-semibold">₹{Number(customer.amount).toLocaleString()}</span>
        </div>

        {customer.due_date && (
          <p className="text-xs text-muted-foreground">Due: {customer.due_date}</p>
        )}

        <div className="relative rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-800">
            <Sparkles className="h-3 w-3" /> AI Insight
          </div>
          <button
            type="button"
            onClick={() => loadInsight(true)}
            disabled={loadingInsight}
            title="Regenerate AI insight"
            className="absolute right-2 top-2 rounded p-1 text-blue-700 hover:bg-blue-700 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingInsight ? "animate-spin" : ""}`} />
          </button>
          <p className="mt-1 pr-6 text-sm">
            {loadingInsight ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
              </span>
            ) : insight || "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!customer.email || sendingMail} onClick={emailReminder}>
            {sendingMail ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />} Email
          </Button>
          <Button size="sm" variant="outline" asChild disabled={!phoneOk}>
            <a
              href={phoneOk ? whatsappLink(customer.phone!, waMsg) : "#"}
              target="_blank" rel="noreferrer"
              onClick={(e) => {
                if (!phoneOk) { e.preventDefault(); toast.error("Invalid mobile number"); return; }
                trackLink("whatsapp", waMsg);
              }}
            ><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</a>
          </Button>
          <Button size="sm" variant="outline" asChild disabled={!phoneOk}>
            <a
              href={phoneOk ? smsLink(customer.phone!, smsMsg) : "#"}
              onClick={(e) => {
                if (!phoneOk) { e.preventDefault(); toast.error("Invalid mobile number"); return; }
                trackLink("sms", smsMsg);
              }}
            ><Phone className="mr-1 h-4 w-4" /> SMS</a>
          </Button>
          <ConfirmDialog
            title={`Delete ${customer.name}?`}
            description="This permanently removes the customer and their history."
            confirmLabel="Delete"
            destructive
            onConfirm={remove}
            trigger={
              <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-600 hover:text-white">
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
