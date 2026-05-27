import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase, logActivity } from "@/lib/supabase";
import { isValidPhone } from "@/lib/templates";
import { Upload, Loader2 } from "lucide-react";

const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = "User_uploads";

type Row = Record<string, unknown>;
function pick(row: Row, keys: string[]): string | undefined {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return String(row[k] ?? "").trim();
  }
  return undefined;
}

export function UploadExcel({ userId, onUploaded }: { userId: string; onUploaded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      return toast.error("File too large. Max 15 MB.");
    }
    setBusy(true);
    try {
      // 1) Parse
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Row[] = XLSX.utils.sheet_to_json(sheet);
      if (!rows.length) throw new Error("Empty file");

      // 2) Upload original to Storage (private bucket, owner folder)
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;

      // 3) Insert customers
      let skipped = 0;
      const inserts = rows.map((r) => {
        const status = (pick(r, ["status"]) || "pending").toLowerCase();
        const rawPhone = pick(r, ["phone", "mobile", "contact"]) || null;
        const phone = rawPhone && isValidPhone(rawPhone) ? rawPhone : null;
        if (rawPhone && !phone) skipped++;
        return {
          user_id: userId,
          name: pick(r, ["name", "customer", "customer name"]) || "Unknown",
          phone,
          email: pick(r, ["email", "mail"]) || null,
          amount: Number(pick(r, ["amount", "due", "balance"]) || 0),
          status: ["paid", "pending", "overdue"].includes(status) ? status : "pending",
          due_date: pick(r, ["due_date", "due date", "duedate"]) || null,
        };
      });
      if (skipped) toast.info(`Skipped ${skipped} invalid phone number(s)`);

      const { error } = await supabase.from("customers").insert(inserts);
      if (error) throw error;

      // 4) File metadata
      await supabase.from("uploaded_files").insert({
        user_id: userId, bucket: BUCKET, path,
        filename: file.name, size_bytes: file.size,
        mime_type: file.type || null, rows_imported: inserts.length,
      });

      toast.success(`Imported ${inserts.length} customers · file saved`);
      logActivity("excel_upload", { count: inserts.length, path });
      onUploaded();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        ref={ref}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />
      <Button onClick={() => ref.current?.click()} variant="outline" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? "Importing..." : "Upload Excel/CSV"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Columns: name, phone, email, amount, status (paid/pending/overdue), due_date · Max 15 MB · stored privately in <code>User_uploads</code>.
      </p>
    </div>
  );
}
