import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { UserCard, type Customer, type Profile } from "@/components/UserCard";
import { ChartSummary } from "@/components/ChartSummary";
import { CustomersTable } from "@/components/CustomersTable";
import { UploadExcel } from "@/components/UploadExcel";
import { ManualAddForm } from "@/components/ManualAddForm";
import { SettingsDialog } from "@/components/SettingsDialog";
import { TemplatesDialog } from "@/components/TemplatesDialog";
import { AutomateDialog } from "@/components/AutomateDialog";
import { AppGuideDialog } from "@/components/AppGuideDialog";
import { ContactDeveloperDialog } from "@/components/ContactDeveloperDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { CompanyNameGate } from "@/components/CompanyNameGate";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { FooterLegal } from "@/components/FooterLegal";
import { sendReminderEmail } from "@/lib/notify";
import { renderTemplate, DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT } from "@/lib/templates";
import { LogOut, Search, Sparkles, Loader2 } from "lucide-react";

const APP = (import.meta.env.VITE_APP_NAME as string | undefined) || "Invoice Flow";

/** Tailwind classes that override tabs to use the dark-blue hover identity. */
const TAB_TRIGGER =
  "data-[state=active]:bg-blue-700 data-[state=active]:text-white hover:bg-blue-700 hover:text-white transition-colors";

export function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // `loading` is only true for the very first fetch so subsequent saves don't
  // tear down the whole UI ("entire page reloads after each save" bug).
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "overdue">("all");
  const [running, setRunning] = useState(false);

  const userId = user!.id;

  const fetchAll = useCallback(async () => {
    const [{ data: p }, { data: cs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("customers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    setProfile(p as Profile | null);
    setCustomers((cs as Customer[] | null) ?? []);
    if (firstLoad.current) {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = useMemo(() => {
    const sum = (s: string) =>
      customers.filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount || 0), 0);
    const cnt = (s: string) => customers.filter((c) => c.status === s).length;
    const paid = sum("paid"),
      pending = sum("pending"),
      overdue = sum("overdue");
    return {
      paid,
      pending,
      overdue,
      total: paid + pending + overdue,
      paidCount: cnt("paid"),
      pendingCount: cnt("pending"),
      overdueCount: cnt("overdue"),
      totalCount: customers.length,
    };
  }, [customers]);

  const visible = useMemo(
    () =>
      customers.filter((c) => {
        if (filter !== "all" && c.status !== filter) return false;
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return (
          c.name.toLowerCase().includes(s) ||
          (c.email ?? "").toLowerCase().includes(s) ||
          (c.phone ?? "").toLowerCase().includes(s)
        );
      }),
    [customers, q, filter],
  );

  async function runAutomationNow() {
    if (!profile?.smtp_user || !profile?.smtp_app_password) {
      return toast.error("Configure Gmail SMTP first");
    }
    setRunning(true);
    const due = customers.filter((c) => c.status !== "paid" && c.email);
    let sent = 0,
      failed = 0;
    const errors: string[] = [];
    for (const c of due) {
      const vars = {
        to_name: c.name,
        from_name: profile.company_name || profile.name || "Us",
        amount: c.amount,
        status: c.status,
        due_date: c.due_date ?? "—",
        upi_link: "",
      };
      try {
        await sendReminderEmail({
          smtp: {
            host: profile.smtp_host,
            port: profile.smtp_port,
            user: profile.smtp_user,
            password: profile.smtp_app_password,
          },
          from_name: profile.company_name || profile.name || "Us",
          to_email: c.email!,
          subject: renderTemplate(profile.email_subject_template || DEFAULT_EMAIL_SUBJECT, vars),
          body: renderTemplate(profile.email_body_template || DEFAULT_EMAIL_BODY, vars),
        });
        await supabase
          .from("notifications_sent")
          .insert({ user_id: userId, customer_id: c.id, channel: "email", message: "manual run" });
        sent++;
      } catch (e) {
        failed++;
        errors.push(`${c.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setRunning(false);
    logActivity("automation_run_now", { sent, failed, errors: errors.slice(0, 5) });
    if (failed)
      toast.error(`Sent ${sent} • Failed ${failed}: ${errors[0] || "check SMTP settings"}`);
    else toast.success(`Sent ${sent} • Failed ${failed}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
      </div>
    );
  }

  if (profile && !profile.company_name) {
    return <CompanyNameGate userId={userId} onSet={fetchAll} />;
  }

  const fromName = profile?.company_name || profile?.name || "Us";

  return (
    <div className="min-h-screen bg-white">
      <AnnouncementBanner />
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-base font-bold text-blue-900 sm:text-lg">
            <Sparkles className="h-5 w-5 text-blue-700" /> {APP}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <AppGuideDialog />
            <FeedbackDialog />
            <ContactDeveloperDialog
              defaultName={profile?.name ?? ""}
              defaultEmail={user?.email ?? ""}
            />
            <TemplatesDialog userId={userId} onSaved={fetchAll} />
            <SettingsDialog userId={userId} onSaved={fetchAll} />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hover:bg-blue-700 hover:text-white"
            >
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">
              Hi {profile?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              <b>{profile?.company_name}</b>
            </p>
          </div>
          <AutomateDialog
            userId={userId}
            onSaved={fetchAll}
            onRunNow={runAutomationNow}
            running={running}
          />
        </div>

        <ChartSummary stats={stats} />

        <Tabs defaultValue="customers">
          <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
            <TabsTrigger value="customers" className={TAB_TRIGGER}>
              Customers
            </TabsTrigger>
            <TabsTrigger value="add" className={TAB_TRIGGER}>
              Add
            </TabsTrigger>
            <TabsTrigger value="import" className={TAB_TRIGGER}>
              Import Excel
            </TabsTrigger>
            <TabsTrigger value="table" className={TAB_TRIGGER}>
              Table view
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-4 pt-4">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-search"
                    name="customer_search"
                    className="pl-9"
                    placeholder="Search name / email / phone"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                {(["all", "paid", "pending", "overdue"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={filter === s ? "default" : "outline"}
                    onClick={() => setFilter(s)}
                    className={
                      filter === s
                        ? "bg-blue-700 hover:bg-blue-900"
                        : "hover:bg-blue-700 hover:text-white"
                    }
                  >
                    {s}
                  </Button>
                ))}
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((c) => (
                <UserCard
                  key={c.id}
                  customer={c}
                  profile={profile!}
                  fromName={fromName}
                  onDeleted={fetchAll}
                />
              ))}
              {visible.length === 0 && (
                <Card>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    No customers match.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="add" className="pt-4">
            <Card>
              <CardContent className="p-5">
                <ManualAddForm userId={userId} onAdded={fetchAll} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="pt-4">
            <Card>
              <CardContent className="p-5">
                <UploadExcel userId={userId} onUploaded={fetchAll} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="pt-4">
            <CustomersTable customers={customers} profile={profile!} fromName={fromName} />
          </TabsContent>
        </Tabs>
      </main>

      <FooterLegal />
    </div>
  );
}
