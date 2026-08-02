import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { Loader2, Sparkles } from "lucide-react";
import { BackButton } from "@/components/BackButton";


const APP = (import.meta.env.VITE_APP_NAME as string | undefined) || "Invoice Flow";

export function Signup() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return toast.error("Name and company are required");
    if (isDisposableEmail(email)) return toast.error("Please use a real (non-disposable) email");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), company_name: company.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — check your email to verify, then log in.");
    nav("/login", { replace: true });
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-blue-50/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <BackButton />

          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-xl font-semibold">Create your {APP} account</h1>
            <p className="mt-1 text-xs text-muted-foreground">Company name is shown to your customers in reminder emails.</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="signup-name">Name</Label><Input id="signup-name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="signup-company">Company</Label><Input id="signup-company" name="organization" autoComplete="organization" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Pvt Ltd" /></div>
            </div>
            <div><Label htmlFor="signup-email">Email</Label><Input id="signup-email" name="email" autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="signup-password">Password</Label><Input id="signup-password" name="password" autoComplete="new-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Sign up"}
            </Button>
          </form>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-card px-2">or</span>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          </div>
          <Button variant="outline" onClick={google} className="w-full">Continue with Google</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already registered? <Link to="/login" className="text-blue-700 hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
