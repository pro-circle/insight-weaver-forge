import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const APP = (import.meta.env.VITE_APP_NAME as string | undefined) || "Invoice Flow";

export function Login() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    nav("/dashboard", { replace: true });
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-blue-50/40 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-xl font-semibold">Log in to {APP}</h1>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label htmlFor="login-email">Email</Label><Input id="login-email" name="email" autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="login-password">Password</Label><Input id="login-password" name="password" autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in…</> : "Log in"}
            </Button>
          </form>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-card px-2">or</span>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          </div>
          <Button variant="outline" onClick={google} className="w-full">Continue with Google</Button>
          <div className="flex items-center justify-between text-sm">
            <Link to="/reset-password" className="text-blue-700 hover:underline">Forgot password?</Link>
            <Link to="/signup" className="text-blue-700 hover:underline">Create account</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
