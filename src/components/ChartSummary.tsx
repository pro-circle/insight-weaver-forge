import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Stats {
  paid: number; pending: number; overdue: number; total: number;
  paidCount: number; pendingCount: number; overdueCount: number; totalCount: number;
}

export function ChartSummary({ stats }: { stats: Stats }) {
  const data = [
    { name: "Paid", value: stats.paid, color: "#16a34a" },
    { name: "Pending", value: stats.pending, color: "#eab308" },
    { name: "Overdue", value: stats.overdue, color: "#dc2626" },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Paid"    value={`₹${stats.paid.toLocaleString()}`}    count={stats.paidCount}    tint="bg-green-50 text-green-800 border-green-200" />
            <Stat label="Pending" value={`₹${stats.pending.toLocaleString()}`} count={stats.pendingCount} tint="bg-yellow-50 text-yellow-800 border-yellow-200" />
            <Stat label="Overdue" value={`₹${stats.overdue.toLocaleString()}`} count={stats.overdueCount} tint="bg-red-50 text-red-800 border-red-200" />
            <Stat label="Total"   value={`₹${stats.total.toLocaleString()}`}   count={stats.totalCount}   tint="bg-blue-50 text-blue-800 border-blue-200" extra="col-span-3" />
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, count, tint, extra = "" }: {
  label: string; value: string; count: number; tint: string; extra?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${tint} ${extra}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-xs opacity-80">{count} {count === 1 ? "customer" : "customers"}</p>
    </div>
  );
}
