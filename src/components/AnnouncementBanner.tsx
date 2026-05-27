import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { logActivity } from "@/lib/supabase";

const KEY = "inv_banner_dismissed_v1";

export function AnnouncementBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !window.localStorage.getItem(KEY)) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="bg-red-600 text-white">
      <div className="container mx-auto flex items-start gap-3 px-6 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="flex-1 leading-relaxed">
          <span className="font-semibold">You're giving feedback for an MVP — Automated Notification System.</span>{" "}
          Invoice Flow helps small businesses track pending payments and send
          Email / WhatsApp / SMS reminders with a UPI pay link. Your feedback shapes the next release. 💖
        </p>
        <button
          onClick={() => {
            window.localStorage.setItem(KEY, "1");
            setShow(false);
            logActivity("banner_dismissed", {});
          }}
          aria-label="Dismiss"
          className="rounded-md p-1 hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
