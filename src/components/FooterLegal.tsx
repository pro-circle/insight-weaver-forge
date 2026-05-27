import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function FooterLegal() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  return (
    <footer className="mt-16 border-t bg-card/60">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Invoice Flow · MVP</p>
        <div className="flex gap-4">
          <button onClick={() => setTerms(true)} className="hover:text-foreground hover:underline">Terms of Service</button>
          <button onClick={() => setPrivacy(true)} className="hover:text-foreground hover:underline">Privacy Policy</button>
        </div>
      </div>

      <Dialog open={terms} onOpenChange={setTerms}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Terms of Service</DialogTitle></DialogHeader>
          <article className="prose prose-sm max-w-none space-y-3 text-sm leading-relaxed">
            <p><b>Last updated:</b> {new Date().toLocaleDateString()}</p>
            <p>Invoice Flow ("the App") is an MVP provided as-is for the purpose of tracking customer payments and sending payment reminders. By using the App you agree to these terms.</p>
            <h3>1. Account & data</h3>
            <p>You are responsible for the accuracy of customer data you upload. You retain ownership of all data you upload. Files uploaded are stored privately in your account.</p>
            <h3>2. Email sending</h3>
            <p>Emails are sent through your own Gmail SMTP using credentials you provide. We do not send email on your behalf and do not access the contents of sent messages.</p>
            <h3>3. Acceptable use</h3>
            <p>You agree not to use the App to send spam, unsolicited messages, or content that violates any laws or third-party rights. Misuse may result in account termination.</p>
            <h3>4. Disclaimer</h3>
            <p>The App is provided "as is" without warranties of any kind. We are not liable for delivery failures, lost data, or damages arising from your use of the App.</p>
            <h3>5. Changes</h3>
            <p>We may update these terms; continued use constitutes acceptance.</p>
            <p className="text-xs text-muted-foreground">(Replace this default copy with your finalized terms before going live.)</p>
          </article>
        </DialogContent>
      </Dialog>

      <Dialog open={privacy} onOpenChange={setPrivacy}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Privacy Policy</DialogTitle></DialogHeader>
          <article className="prose prose-sm max-w-none space-y-3 text-sm leading-relaxed">
            <p><b>Last updated:</b> {new Date().toLocaleDateString()}</p>
            <h3>1. What we store</h3>
            <ul className="list-disc pl-5">
              <li>Account: name, email, company name, phone.</li>
              <li>SMTP credentials (host, port, Gmail address, app password) — used only to send your emails from your account.</li>
              <li>Customer records and uploaded spreadsheets.</li>
              <li>Activity logs (button clicks, notifications sent, settings changes) used to improve the product.</li>
            </ul>
            <h3>2. Where it is stored</h3>
            <p>All data is stored in your Supabase project with Row-Level Security: only your account can read or modify your rows. Uploaded files live in the private <code>User_uploads</code> bucket.</p>
            <h3>3. Third parties</h3>
            <p>Email reminders go through your own Gmail. AI insights are generated via Groq API. "Contact Developer" messages are sent via EmailJS to the developer.</p>
            <h3>4. Your rights</h3>
            <p>You may delete your customers, uploaded files, or account at any time. Deleting your account removes all associated rows.</p>
            <p className="text-xs text-muted-foreground">(Replace this default copy with your finalized policy before going live.)</p>
            <h3>5. App Tour video — how to replace</h3>
            <p>Upload your tour video to Supabase Storage → bucket <code>User_uploads</code> → folder <code>public/</code>, copy its public URL, and set <code>VITE_APP_TOUR_VIDEO_URL</code> in your <code>.env</code>.</p>
          </article>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
