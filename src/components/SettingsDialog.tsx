import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { Settings, Loader2 } from "lucide-react";
import { isValidPhone } from "@/lib/templates";
import { CountryPhoneInput } from "./CountryPhoneInput";
import { SecretInput } from "./SecretInput";

interface Form {
  company_name: string;
  phone: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_app_password: string;
}

const empty: Form = {
  company_name: "", phone: "",
  smtp_host: "smtp.gmail.com", smtp_port: 587,
  smtp_user: "", smtp_app_password: "",
};

export function SettingsDialog({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("profiles").select("*").eq("id", userId).single().then(({ data }) => {
      if (data) {
        setF({
          company_name: data.company_name ?? "",
          phone: data.phone ?? "",
          smtp_host: data.smtp_host ?? "smtp.gmail.com",
          smtp_port: data.smtp_port ?? 587,
          smtp_user: data.smtp_user ?? "",
          smtp_app_password: data.smtp_app_password ?? "",
        });
      }
      setLoading(false);
    });
  }, [open, userId]);

  async function save() {
    if (f.phone && !isValidPhone(f.phone)) return toast.error("Enter a valid 10-digit mobile number");
    if (f.smtp_user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.smtp_user)) return toast.error("Gmail address looks invalid");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      company_name: f.company_name || null,
      phone: f.phone || null,
      smtp_host: f.smtp_host || "smtp.gmail.com",
      smtp_port: Number(f.smtp_port) || 587,
      smtp_user: f.smtp_user || null,
      smtp_app_password: f.smtp_app_password || null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved ✨");
    logActivity("settings_saved", {});
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hover:bg-blue-700 hover:text-white">
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your account & SMTP</DialogTitle>
          <DialogDescription>
            Company info, contact phone, and the Gmail SMTP that sends your reminders.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-700" /></div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="settings-company-name">Company name</Label>
              <Input id="settings-company-name" name="organization" autoComplete="organization" value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} placeholder="Acme Pvt Ltd" />
            </div>
            <div>
              <Label htmlFor="settings-phone">Your contact phone (shown to customers)</Label>
              <CountryPhoneInput id="settings-phone" name="phone" autoComplete="tel" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
              <p className="mt-1 text-xs text-muted-foreground">Country auto-detected · max 10 local digits.</p>
            </div>

            <div className="rounded-lg border bg-secondary/30 p-3">
              <p className="text-sm font-medium">Gmail SMTP</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                See <b>App Guide → Email setup</b> for the 16-character App Password walk-through.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="settings-smtp-host">SMTP host</Label>
                  <Input id="settings-smtp-host" name="smtp_host" value={f.smtp_host} onChange={(e) => setF({ ...f, smtp_host: e.target.value })} />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="settings-smtp-port">Port</Label>
                  <Input id="settings-smtp-port" name="smtp_port" type="number" value={f.smtp_port} onChange={(e) => setF({ ...f, smtp_port: Number(e.target.value) || 587 })} />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="settings-smtp-user">Gmail address</Label>
                <Input id="settings-smtp-user" name="email" autoComplete="email" type="email" value={f.smtp_user} onChange={(e) => setF({ ...f, smtp_user: e.target.value })} placeholder="you@gmail.com" />
              </div>
              <div className="mt-3">
                <Label htmlFor="settings-smtp-password">App password (16 characters)</Label>
                <SecretInput
                  id="settings-smtp-password"
                  name="current-password"
                  value={f.smtp_app_password}
                  onChange={(v) => setF({ ...f, smtp_app_password: v })}
                  placeholder="abcd efgh ijkl mnop"
                />
                <p className="mt-1 text-xs text-muted-foreground">Spaces are okay — we strip them automatically. Click 👁 to reveal.</p>
              </div>
            </div>

            <Button onClick={save} disabled={busy} className="w-full bg-blue-700 hover:bg-blue-900">
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
