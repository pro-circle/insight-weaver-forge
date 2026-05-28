import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { FileText, Loader2, Pencil } from "lucide-react";
import {
  DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT, DEFAULT_SMS, DEFAULT_WHATSAPP,
} from "@/lib/templates";
import { SecretInput } from "./SecretInput";
import { VariableTextarea } from "./VariableTextarea";

interface Form {
  email_subject_template: string;
  email_body_template: string;
  whatsapp_template: string;
  sms_template: string;
  enable_upi: boolean;
  upi_id: string;
  payee_name: string;
}
const empty: Form = {
  email_subject_template: DEFAULT_EMAIL_SUBJECT,
  email_body_template: DEFAULT_EMAIL_BODY,
  whatsapp_template: DEFAULT_WHATSAPP,
  sms_template: DEFAULT_SMS,
  enable_upi: true, upi_id: "", payee_name: "",
};

const TAB_TRIGGER =
  "data-[state=active]:bg-blue-700 data-[state=active]:text-white hover:bg-blue-700 hover:text-white transition-colors";

export function TemplatesDialog({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editUpi, setEditUpi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("profiles").select("*").eq("id", userId).single().then(({ data }) => {
      if (data) {
        setF({
          email_subject_template: data.email_subject_template || DEFAULT_EMAIL_SUBJECT,
          email_body_template:    data.email_body_template    || DEFAULT_EMAIL_BODY,
          whatsapp_template:      data.whatsapp_template      || DEFAULT_WHATSAPP,
          sms_template:           data.sms_template           || DEFAULT_SMS,
          enable_upi: data.enable_upi ?? true,
          upi_id: data.upi_id ?? "",
          payee_name: data.payee_name ?? "",
        });
        setEditUpi(!data.upi_id);
      }
      setLoading(false);
    });
  }, [open, userId]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      ...f,
      upi_id: f.upi_id || null,
      payee_name: f.payee_name || null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Templates saved ✨");
    logActivity("templates_saved", {});
    setEditUpi(false);
    onSaved();
    setOpen(false);
  }

  function resetTemplates() {
    setF({
      ...f,
      email_subject_template: DEFAULT_EMAIL_SUBJECT,
      email_body_template: DEFAULT_EMAIL_BODY,
      whatsapp_template: DEFAULT_WHATSAPP,
      sms_template: DEFAULT_SMS,
    });
    toast.info("Templates reset to defaults — click Save to keep");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hover:bg-blue-700 hover:text-white"><FileText className="mr-2 h-4 w-4" /> Templates</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message templates & UPI</DialogTitle>
          <DialogDescription>
            Drag the variable chips into the message body — they're locked once inserted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <Tabs defaultValue="email" className="mt-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email" className={TAB_TRIGGER}>Email</TabsTrigger>
                <TabsTrigger value="whatsapp" className={TAB_TRIGGER}>WhatsApp</TabsTrigger>
                <TabsTrigger value="sms" className={TAB_TRIGGER}>SMS</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3 pt-4">
                <div>
                  <Label htmlFor="template-email-subject">Subject</Label>
                  <Input id="template-email-subject" name="email_subject_template" value={f.email_subject_template} onChange={(e) => setF({ ...f, email_subject_template: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="template-email-body">Body</Label>
                  <VariableTextarea id="template-email-body" name="email_body_template" rows={8} value={f.email_body_template} onChange={(v) => setF({ ...f, email_body_template: v })} />
                </div>
              </TabsContent>
              <TabsContent value="whatsapp" className="pt-4">
                <Label htmlFor="template-whatsapp-message">WhatsApp message</Label>
                <VariableTextarea id="template-whatsapp-message" name="whatsapp_template" rows={4} value={f.whatsapp_template} onChange={(v) => setF({ ...f, whatsapp_template: v })} />
              </TabsContent>
              <TabsContent value="sms" className="pt-4">
                <Label htmlFor="template-sms-message">SMS message</Label>
                <VariableTextarea id="template-sms-message" name="sms_template" rows={3} value={f.sms_template} onChange={(v) => setF({ ...f, sms_template: v })} />
              </TabsContent>
            </Tabs>

            <div className="mt-6 rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">UPI pay link</p>
                  <p className="text-xs text-muted-foreground">Added to <code>{`{{upi_link}}`}</code> inside your messages.</p>
                </div>
                <Switch checked={f.enable_upi} onCheckedChange={(v) => setF({ ...f, enable_upi: v })} />
              </div>

              {!editUpi && f.upi_id ? (
                <div className="flex items-center justify-between rounded-md bg-secondary/40 p-3">
                  <div className="text-sm">
                    <p><span className="text-muted-foreground">UPI:</span> <b>•••••••• (hidden)</b></p>
                    <p><span className="text-muted-foreground">Payee:</span> <b>{f.payee_name || "—"}</b></p>
                  </div>
                  <Button variant="ghost" size="sm" className="hover:bg-blue-700 hover:text-white" onClick={() => setEditUpi(true)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit / reveal
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="template-upi-id">UPI ID</Label>
                    <SecretInput id="template-upi-id" name="upi_id" value={f.upi_id} onChange={(v) => setF({ ...f, upi_id: v })} placeholder="yourname@oksbi" />
                  </div>
                  <div><Label htmlFor="template-payee-name">Payee name</Label><Input id="template-payee-name" name="payee_name" autoComplete="name" value={f.payee_name} onChange={(e) => setF({ ...f, payee_name: e.target.value })} placeholder="Your name" /></div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button onClick={save} disabled={busy} className="flex-1 bg-blue-700 hover:bg-blue-900">{busy ? "Saving..." : "Save"}</Button>
              <Button type="button" variant="ghost" className="hover:bg-blue-700 hover:text-white" onClick={resetTemplates}>Reset templates</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
