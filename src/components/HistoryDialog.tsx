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
type Row = {
  id: string;
  channel: Channel;
  status: "sent" | "failed";
  created_at: string;
  customer: { name: string | null; email: string | null; phone: string | null } | null;
};

const META: Record<Channel, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: Phone },
};

export function HistoryDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("notifications_sent")
      .select("id, channel, status, created_at, customer:customers(name,email,phone)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data as unknown as Row[]) ?? []);
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
            Sent vs. failed counts per channel. Click a row to view the chart and recent recipients.
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
              <ChannelRow
                key={ch}
                channel={ch}
                rows={rows.filter((r) => r.channel === ch)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelRow({ channel, rows }: { channel: Channel; rows: Row[] }) {
  const { label, icon: Icon } = META[channel];
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const total = sent + failed;
  const data = [
    { name: "Sent", value: sent, color: "#16a34a" },
    { name: "Failed", value: failed, color: "#dc2626" },
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
            <b className="text-green-700">{sent}</b> sent ·{" "}
            <b className="text-red-700">{failed}</b> failed
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t p-4">
          {total === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} activity yet.
            </p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent activity
                </p>
                <ul className="divide-y rounded-md border">
                  {rows.slice(0, 25).map((r) => {
                    const d = new Date(r.created_at);
                    const day = d.toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    });
                    const time = d.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const recipient =
                      r.customer?.name ||
                      r.customer?.email ||
                      r.customer?.phone ||
                      "—";
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              r.status === "sent" ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                          <span className="truncate font-medium">{recipient}</span>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          <span>{day}</span> · <span>{time}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
