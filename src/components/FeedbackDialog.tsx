import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export function FeedbackDialog() {
  const url = import.meta.env.VITE_FEEDBACK_GOOGLE_FORM_URL as string | undefined;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><MessageSquare className="mr-2 h-4 w-4" /> Feedback</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Share your feedback 💖</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Your valuable feedback helps us to greatly improve our product 💖
          </p>
        </DialogHeader>
        <div className="h-[78vh] w-full bg-secondary/30">
          {url ? (
            <iframe
              title="Feedback Form"
              src={url}
              className="h-full w-full border-0"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Feedback form URL not configured. Set <code>VITE_FEEDBACK_GOOGLE_FORM_URL</code> in .env.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
