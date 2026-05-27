import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";
import { logActivity } from "@/lib/supabase";

/**
 * Draggable, dismissible YouTube player for the in-app tour.
 * Accepts either:
 *   • `VITE_APP_TOUR_YOUTUBE_ID` — bare YouTube ID (e.g. `dQw4w9WgXcQ`), or
 *   • `VITE_APP_TOUR_VIDEO_URL`  — full YouTube URL (watch, youtu.be, shorts, embed).
 * Falls back to a friendly empty state if neither is set or the URL is unparseable.
 */
function extractYouTubeId(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // Already a bare ID (11 chars, URL-safe).
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    if (u.hostname.endsWith("youtu.be")) {
      const id = u.pathname.replace(/^\//, "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch { /* not a URL */ }
  return "";
}

const YT_ID = extractYouTubeId(
  (import.meta.env.VITE_APP_TOUR_YOUTUBE_ID as string | undefined) ||
  (import.meta.env.VITE_APP_TOUR_VIDEO_URL as string | undefined) ||
  "",
);


export function DraggableTourCard({ onClose }: { onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth - 580),
    y: 90,
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => { logActivity("app_tour_opened", { youtube_id: YT_ID || null }); }, []);

  function onPointerDown(e: React.PointerEvent) {
    const rect = cardRef.current!.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 220, ev.clientX - dragRef.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dragRef.current.dy)),
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const embedSrc = YT_ID
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(YT_ID)}?autoplay=1&rel=0&modestbranding=1`
    : "";

  return (
    <div
      ref={cardRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-[560px] max-w-[95vw] overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl ring-1 ring-blue-100"
    >
      <div
        onPointerDown={onPointerDown}
        className="flex cursor-move select-none items-center justify-between border-b bg-gradient-to-r from-blue-50 to-blue-100/60 px-3 py-2"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <GripVertical className="h-4 w-4 text-blue-700" /> 🎬 Invoice Flow — App Tour
        </div>
        <Button
          size="icon" variant="ghost"
          className="h-7 w-7 hover:bg-blue-700 hover:text-white"
          onClick={onClose} aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {embedSrc ? (
        <iframe
          title="Invoice Flow app tour"
          src={embedSrc}
          className="aspect-video w-full bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="aspect-video w-full bg-blue-50 p-6 text-center text-sm text-blue-900">
          <p className="font-medium">Tour video not configured.</p>
          <p className="mt-2 text-xs">
            Set <code>VITE_APP_TOUR_YOUTUBE_ID</code> in your <code>.env</code> to a YouTube video ID and rebuild.
          </p>
        </div>
      )}
      <p className="bg-white px-3 py-2 text-xs text-muted-foreground">
        Drag the title bar to move the player. The page stays scrollable.
      </p>
    </div>
  );
}
