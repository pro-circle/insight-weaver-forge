import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// Forces Google-OAuth users to set company_name before using the dashboard.
export function CompanyNameGate({ userId, onSet }: { userId: string; onSet: () => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!v.trim()) return toast.error("Company name is required");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ company_name: v.trim() }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome!");
    onSet();
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>One more step</DialogTitle>
          <DialogDescription>Tell us your company name to finish setting up your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="company-gate-name">Company name</Label>
            <Input id="company-gate-name" name="organization" autoComplete="organization" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Acme Pvt Ltd" />
          </div>
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Saving..." : "Continue"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
