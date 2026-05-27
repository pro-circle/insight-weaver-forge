// AI insight client — calls Supabase Edge Function `ai-insight`.
// The edge function handles the fallback chain (Groq1 -> Gemini 2.5 Flash -> Groq2)
// and caches results in `customers.ai_insight` keyed by a sha256 hash of
// (amount|status|due_date). Cache is invalidated automatically on data change
// or manually via force=true.
import { supabase } from "@/lib/supabase";

export interface InsightInput {
  customerId?: string;
  name: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  due_date: string | null;
  force?: boolean;
}

export interface InsightResponse {
  ok: boolean;
  text: string;
  cached: boolean;
  provider?: string;
  error?: string;
}

export async function getInsight(input: InsightInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke<InsightResponse>("ai-insight", {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "AI insight failed");
  return data.text;
}
