import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";


export function ResetPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Check your inbox for the reset link.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-blue-50/40 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <BackButton />
          <h1 className="text-xl font-semibold">Reset your password</h1>

          {sent ? (
            <p className="text-sm text-muted-foreground">
              If that email exists, a reset link is on its way. Check spam too.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div><Label htmlFor="reset-email">Email</Label><Input id="reset-email" name="email" autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="text-center text-sm"><Link to="/login" className="text-blue-700 hover:underline">Back to log in</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
