import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendContactDeveloper } from "@/lib/notify";
import { logActivity } from "@/lib/supabase";
import { Send, Loader2 } from "lucide-react";

export function ContactDeveloperDialog({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return toast.error("Please type a message");
    if (message.length > 2000) return toast.error("Max 2000 characters");
    setBusy(true);
    try {
      await sendContactDeveloper({ name, user_email: email, user_message: message });
      logActivity("contact_developer", {});
      toast.success("Message sent — thank you!");
      setMessage("");
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setName(defaultName); setEmail(defaultEmail); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Send className="mr-2 h-4 w-4" /> Contact Developer</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contact the developer</DialogTitle>
          <DialogDescription>
            Direct line to the dev. Your name and email are pre-filled from your account — feel free to edit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label htmlFor="contact-developer-name">Name</Label><Input id="contact-developer-name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="contact-developer-email">Email</Label><Input id="contact-developer-email" name="email" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div>
            <Label htmlFor="contact-developer-message">Message ({message.length}/2000)</Label>
            <Textarea
              id="contact-developer-message"
              name="message"
              rows={8}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              className="resize-none"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
