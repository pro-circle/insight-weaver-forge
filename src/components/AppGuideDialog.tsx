import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, PlayCircle, Mail, ChevronLeft, Workflow } from "lucide-react";
import { logActivity } from "@/lib/supabase";
import { DraggableTourCard } from "./DraggableTourCard";

type View = "home" | "smtp" | "workflow";

/**
 * App Guide entry-point. Single dialog that hosts three views:
 *   - home: tour button + two large entry tiles
 *   - smtp: complete Gmail SMTP setup walk-through
 *   - workflow: end-to-end "import → automate → notify" overview
 */
export function AppGuideDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [tour, setTour] = useState(false);

  useEffect(() => { if (open) logActivity("app_guide_opened", { view }); }, [open, view]);
  useEffect(() => { if (!open) setView("home"); }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="hover:bg-blue-700 hover:text-white">
            <BookOpen className="mr-2 h-4 w-4" /> App Guide
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {view !== "home" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setView("home")} aria-label="Back">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {view === "home" ? "App Guide" : view === "smtp" ? "Email setup (Gmail SMTP)" : "Automation workflow"}
            </DialogTitle>
            <DialogDescription>
              {view === "home" && "Watch the tour, set up email, or learn the automation workflow."}
              {view === "smtp" && "Complete step-by-step Gmail SMTP setup using a 16-character App Password."}
              {view === "workflow" && "From importing customers to fully automated email reminders."}
            </DialogDescription>
          </DialogHeader>

          {view === "home" && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4">
                <p className="text-sm font-semibold text-blue-900">🎬 App Tour</p>
                <p className="mt-1 text-xs text-blue-900/80">
                  Watch a short walk-through (YouTube). The player is draggable.
                </p>
                <Button
                  onClick={() => { setTour(true); setOpen(false); }}
                  className="mt-3 w-full bg-blue-700 hover:bg-blue-900"
                >
                  <PlayCircle className="mr-2 h-4 w-4" /> Play App Tour
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button" onClick={() => setView("smtp")}
                  className="group rounded-xl border bg-white p-4 text-left transition-all hover:border-blue-700 hover:shadow-md"
                >
                  <Mail className="h-6 w-6 text-blue-700" />
                  <p className="mt-2 text-sm font-semibold group-hover:text-blue-900">Email setup</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generate a Gmail App Password and paste it into Settings.
                  </p>
                </button>

                <button
                  type="button" onClick={() => setView("workflow")}
                  className="group rounded-xl border bg-white p-4 text-left transition-all hover:border-blue-700 hover:shadow-md"
                >
                  <Workflow className="h-6 w-6 text-blue-700" />
                  <p className="mt-2 text-sm font-semibold group-hover:text-blue-900">Automation workflow</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Import / add customers, set up daily auto-emails, and use semi-automated WhatsApp & SMS.
                  </p>
                </button>
              </div>
            </div>
          )}

          {view === "smtp" && (
            <ol className="mt-2 space-y-4 text-sm">
              <Step n={1} title="Turn on 2-Step Verification in Google">
                Open <A href="https://myaccount.google.com/security">myaccount.google.com/security</A> and enable
                <b> 2-Step Verification</b>. Required before App Passwords can be created.
              </Step>
              <Step n={2} title="Generate a Gmail App Password (16 characters)">
                Open <A href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</A>,
                pick app <b>Mail</b> and device <b>Other → "Invoice Flow"</b>, click <b>Generate</b>.
                Copy the 16-character password (spaces are fine, we strip them).
              </Step>
              <Step n={3} title="Open Settings → Gmail SMTP">
                Click the <b>Settings</b> button in the dashboard header. Fill in:
                <ul className="ml-4 mt-1 list-disc">
                  <li>Host: <code>smtp.gmail.com</code></li>
                  <li>Port: <code>587</code></li>
                  <li>Gmail address: your full Gmail</li>
                  <li>App password: the 16-char password from step 2 (use the 👁 icon to verify)</li>
                </ul>
                Click <b>Save</b>. Credentials are stored under your account with Row Level Security — only you can read them.
              </Step>
              <Step n={4} title="Send a test reminder">
                Add a customer with your own email, then click <b>Email</b> on their card.
                Check the inbox ✅. If you see a Gmail error, regenerate the App Password and re-paste.
              </Step>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <b>Privacy:</b> SMTP credentials never leave your Supabase row. The browser never holds
                the password — it is read by the <code>send-email</code> Edge Function only at send time.
              </div>
            </ol>
          )}

          {view === "workflow" && (
            <ol className="mt-2 space-y-4 text-sm">
              <Step n={1} title="Add customers">
                Use <b>Add</b> for a single customer or <b>Import Excel</b> to upload many at once
                (columns: name, phone, email, amount, status, due_date). Files are stored privately in <code>User_uploads</code>.
              </Step>
              <Step n={2} title="Customise message templates (optional)">
                Open <b>Templates</b> in the header. Edit email / WhatsApp / SMS wording.
                Keep <code>{`{{variables}}`}</code> intact — they're filled in per-customer.
                A UPI <b>Click here to pay now</b> link with the exact amount is auto-attached.
              </Step>
              <Step n={3} title="Set up automation (server-side cron)">
                Open <b>Automate email reminders</b>, toggle it on and pick a daily send time.
                A Supabase Edge Function (<code>automate-reminders</code>) is invoked by pg_cron
                and emails every customer whose status isn't <i>paid</i>. <b>The app does not need to be open.</b>
              </Step>
              <Step n={4} title="Channels — what's automated vs. semi-automated">
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Channel title="Email" mode="Fully automated" desc="Sent server-side via your Gmail SMTP." />
                  <Channel title="WhatsApp" mode="Semi-automated" desc="Opens a pre-filled wa.me chat — you tap Send." />
                  <Channel title="SMS" mode="Semi-automated" desc="Opens your phone's SMS app pre-filled — you tap Send." />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  WhatsApp & SMS require the user's tap-to-send because mobile providers don't allow silent sending from the browser.
                </p>
              </Step>
              <Step n={5} title="Track everything">
                Each send is logged to <code>notifications_sent</code> and <code>activity_logs</code>
                so you have a full audit trail per customer.
              </Step>
            </ol>
          )}
        </DialogContent>
      </Dialog>

      {tour && <DraggableTourCard onClose={() => setTour(false)} />}
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 font-medium">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-800">{n}</span>
        {title}
      </div>
      <div className="mt-2 pl-8 text-muted-foreground">{children}</div>
    </li>
  );
}
function Channel({ title, mode, desc }: { title: string; mode: string; desc: string }) {
  return (
    <div className="rounded-md border bg-white p-2">
      <p className="text-xs font-semibold text-blue-900">{title}</p>
      <p className="text-[10px] uppercase tracking-wide text-blue-700">{mode}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline hover:text-blue-900">{children}</a>;
}
