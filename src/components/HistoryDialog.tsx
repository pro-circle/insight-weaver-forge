import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChevronDown, History, Mail, MessageCircle, Phone } from "lucide-react";

type Channel = "email" | "whatsapp" | "sms";
type Counts = Record<Channel, { sent: number; failed: number }>;

const empty: Counts = {
  email: { sent: 0, failed: 0 },
  whatsapp: { sent: 0, failed: 0 },
  sms: { sent: 0, failed: 0 },
};

const META: Record<Channel, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: Phone },
};

export function HistoryDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Counts>(empty);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("notifications_sent")
      .select("channel, status")
      .eq("user_id", userId)
      .then(({ data }) => {
        const next: Counts = JSON.parse(JSON.stringify(empty));
        (data ?? []).forEach((r: { channel: string; status: string | null }) => {
          const ch = r.channel as Channel;
          if (!(ch in next)) return;
          const bucket = r.status === "failed" ? "failed" : "sent";
          next[ch][bucket]++;
        });
        setCounts(next);
        setLoading(false);
      });
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hover:bg-blue-700 hover:text-white">
          <History className="mr-2 h-4 w-4" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification history</DialogTitle>
          <DialogDescription>
            Sent vs. failed counts per channel. Click a row to view the chart.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {(Object.keys(META) as Channel[]).map((ch) => (
              <ChannelRow key={ch} channel={ch} counts={counts[ch]} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelRow({
  channel,
  counts,
}: {
  channel: Channel;
  counts: { sent: number; failed: number };
}) {
  const { label, icon: Icon } = META[channel];
  const total = counts.sent + counts.failed;
  const data = [
    { name: "Sent", value: counts.sent, color: "#16a34a" },
    { name: "Failed", value: counts.failed, color: "#dc2626" },
  ];

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-blue-50">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-700" />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <b className="text-green-700">{counts.sent}</b> sent ·{" "}
            <b className="text-red-700">{counts.failed}</b> failed
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-4">
          {total === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} activity yet.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {data.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v}`, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
