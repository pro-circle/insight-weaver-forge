import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Mail, MessageCircle, Phone, FileSpreadsheet, Zap } from "lucide-react";
import { FooterLegal } from "@/components/FooterLegal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { LearnMoreDialog } from "@/components/LearnMoreDialog";

const APP = (import.meta.env.VITE_APP_NAME as string | undefined) || "Invoice Flow";

export function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <AnnouncementBanner />
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-900">
          <Sparkles className="h-5 w-5 text-blue-700" /> {APP}
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hover:!bg-green-600 hover:!text-white">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild><Link to="/signup">Get started</Link></Button>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-16">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-blue-950 sm:text-5xl">
            Get paid faster with smart reminders.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            {APP} helps small businesses track pending payments and send automated
            <b> Email</b>, <b> WhatsApp</b> and <b> SMS</b> reminders with a one-tap UPI pay link.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild><Link to="/signup">Start free</Link></Button>
            <LearnMoreDialog
              trigger={
                <Button
                  size="lg"
                  variant="outline"
                  className="group relative overflow-hidden border-2 border-black bg-white font-semibold text-black shadow-sm transition-colors hover:!border-green-600 hover:!bg-green-600 hover:!text-white"
                >
                  {/* Default shimmer sweep — visible inside the button */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/15 to-transparent animate-[shimmer_2.2s_linear_infinite] group-hover:via-white/40"
                    style={{
                      // keyframes registered inline so we don't need tailwind config edits
                      animationName: "lm-shimmer",
                    }}
                  />
                  <style>{`@keyframes lm-shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }`}</style>
                  <span className="relative">Learn more</span>
                </Button>
              }
            />
          </div>
        </section>

        <section className="mx-auto mt-20 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<FileSpreadsheet className="h-5 w-5" />} title="Bulk import" desc="Upload Excel / CSV — we map columns automatically." />
          <Feature icon={<Mail className="h-5 w-5" />} title="Gmail SMTP" desc="Send from your own Gmail using a 16-char App Password." />
          <Feature icon={<MessageCircle className="h-5 w-5" />} title="WhatsApp & SMS" desc="One-click deep links with editable templates." />
          <Feature icon={<Zap className="h-5 w-5" />} title="Daily automation" desc="Server-side cron sends reminders at your chosen time." />
        </section>
      </main>

      <FooterLegal />
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-blue-700">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{icon}</div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
