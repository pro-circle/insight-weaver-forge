import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { Zap, Loader2 } from "lucide-react";

export function AutomateDialog({
  userId, onSaved, onRunNow, running,
}: {
  userId: string; onSaved: () => void; onRunNow: () => void; running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("profiles").select("automation_enabled, automation_time").eq("id", userId).single().then(({ data }) => {
      if (data) {
        setEnabled(!!data.automation_enabled);
        setTime(data.automation_time || "09:00");
      }
      setLoading(false);
    });
  }, [open, userId]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      automation_enabled: enabled,
      automation_time: time,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(enabled ? `Automation set for ${time} daily` : "Automation disabled");
    logActivity("automation_saved", { enabled, time });
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Zap className="mr-2 h-4 w-4" /> Automate email reminders
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Automate email reminders</DialogTitle>
          <DialogDescription>
            Pick a daily time to auto-send reminders to all customers whose status isn't paid.
            <span className="mt-1 block text-xs">
              ✅ Runs on the server (pg_cron + Supabase Edge Function) — no need to keep the app open.
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable daily automation</p>
                <p className="text-xs text-muted-foreground">Runs at the time below (your local time).</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div>
              <Label htmlFor="automation-send-time">Send time (24-hour)</Label>
              <Input id="automation-send-time" name="automation_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy} className="flex-1">
                {busy ? "Saving..." : "Save schedule"}
              </Button>
              <Button variant="outline" onClick={onRunNow} disabled={running}>
                {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Run now"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
