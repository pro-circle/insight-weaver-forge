import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { isValidPhone } from "@/lib/templates";
import { CountryPhoneInput } from "./CountryPhoneInput";
import { Plus } from "lucide-react";

export function ManualAddForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", amount: "", status: "pending", due_date: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return toast.error("Name and amount required");
    if (form.name.length > 100) return toast.error("Name too long");
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit mobile number");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Enter a valid email");
    if (Number(form.amount) < 0 || Number(form.amount) > 1e9) return toast.error("Amount out of range");
    setBusy(true);
    const { error } = await supabase.from("customers").insert({
      user_id: userId,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email.trim() || null,
      amount: Number(form.amount),
      status: form.status,
      due_date: form.due_date || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    logActivity("customer_added", { method: "manual" });
    setForm({ name: "", phone: "", email: "", amount: "", status: "pending", due_date: "" });
    onAdded();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div><Label htmlFor="manual-customer-name">Name *</Label><Input id="manual-customer-name" name="name" autoComplete="name" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div>
        <Label htmlFor="manual-customer-phone">Phone</Label>
        <CountryPhoneInput id="manual-customer-phone" name="phone" autoComplete="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <div><Label htmlFor="manual-customer-email">Email</Label><Input id="manual-customer-email" name="email" autoComplete="email" type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label htmlFor="manual-customer-amount">Amount *</Label><Input id="manual-customer-amount" name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
      <div>
        <Label htmlFor="manual-customer-status">Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger id="manual-customer-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label htmlFor="manual-customer-due-date">Due date</Label><Input id="manual-customer-due-date" name="due_date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={busy} className="bg-blue-700 hover:bg-blue-900">
          <Plus className="mr-2 h-4 w-4" />{busy ? "Adding..." : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
