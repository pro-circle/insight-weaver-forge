import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, PlayCircle, ImageIcon } from "lucide-react";

const APP =
  (import.meta.env.VITE_APP_NAME as string | undefined) || "Invoice Flow";

/**
 * "Learn more" dialog shown on the landing page.
 *
 * Zigzag layout sections — to add real screenshots, drop image files into
 * src/assets/learn-more/ (e.g. dashboard.jpg, automate.jpg, history.jpg),
 * import them at the top of this file, e.g.
 *   import dashboardImg from "@/assets/learn-more/dashboard.jpg";
 * and pass <img src={dashboardImg} loading="lazy" decoding="async" .../> via
 * the `image` prop of <Row>. Until then, neutral placeholders are rendered.
 */
export function LearnMoreDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Info className="h-5 w-5 text-blue-700" /> About {APP}
          </DialogTitle>
          <DialogDescription>
            Everything {APP} does — and how it helps you get paid faster.
          </DialogDescription>
        </DialogHeader>

        {/* Top description */}
        <section className="rounded-xl border bg-blue-50/40 p-5">
          <h3 className="text-lg font-semibold text-blue-950">
            Why {APP}?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Small businesses lose hours every week chasing pending invoices.
            {" "}{APP} centralises your customer list, tracks dues, and sends
            automated <b>Email</b>, <b>WhatsApp</b> and <b>SMS</b> reminders
            with a one-tap UPI pay link — so your customers can pay you in
            seconds, and you never have to write another follow-up message.
          </p>
        </section>

        {/* Video */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <PlayCircle className="h-5 w-5 text-blue-700" /> Watch the app guide
          </h3>
          <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black/5">
            {/* Replace VIDEO_ID below with your YouTube ID, or swap for a <video src=...> */}
            <iframe
              loading="lazy"
              className="h-full w-full"
              src="https://www.youtube.com/embed/VIDEO_ID"
              title="App guide"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>

        {/* Zigzag rows */}
        <section className="space-y-6 pt-2">
          <Row
            side="left"
            title="One dashboard for every pending payment"
            desc="Import customers from Excel or add them manually. See paid, pending and overdue totals at a glance with live charts."
          />
          <Row
            side="right"
            title="Daily automation that just works"
            desc="Pick a time, pick the channels, and we'll quietly send reminders every day. Server-side cron — no need to keep the app open."
          />
          <Row
            side="left"
            title="Email, WhatsApp & SMS with UPI links"
            desc="Send through your own Gmail SMTP and open WhatsApp / SMS deep links with editable templates. Every message can carry a UPI pay link so customers pay in one tap."
          />
          <Row
            side="right"
            title="Full history & analytics"
            desc="Every send — sent or failed — is logged with day, time and recipient. Donut charts break down activity per channel so you always know what's working."
          />
        </section>

        <div className="flex justify-end pt-2">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  side,
  title,
  desc,
  image,
}: {
  side: "left" | "right";
  title: string;
  desc: string;
  image?: ReactNode;
}) {
  const imgBlock = (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 text-blue-400">
      {image ?? <ImageIcon className="h-10 w-10" aria-hidden />}
    </div>
  );
  const textBlock = (
    <div className="flex flex-col justify-center">
      <h4 className="text-base font-semibold text-blue-950">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
  return (
    <div className="grid items-center gap-4 md:grid-cols-2">
      {side === "left" ? (
        <>
          {imgBlock}
          {textBlock}
        </>
      ) : (
        <>
          <div className="order-2 md:order-1">{textBlock}</div>
          <div className="order-1 md:order-2">{imgBlock}</div>
        </>
      )}
    </div>
  );
}
