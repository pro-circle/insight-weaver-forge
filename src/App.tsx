import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Index } from "@/pages/Index";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { Dashboard } from "@/pages/Dashboard";
import { ResetPassword } from "@/pages/ResetPassword";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function VisitorLogger() {
  const loc = useLocation();
  useEffect(() => {
    supabase.from("visitor_logs").insert({ path: loc.pathname, user_agent: navigator.userAgent }).then(() => {});
  }, [loc.pathname]);
  return null;
}

export function App() {
  return (
    <>
      <VisitorLogger />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
