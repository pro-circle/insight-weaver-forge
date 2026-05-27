// AI Insight with provider fallback chain:
//   1) Groq (GROQ_API_KEY_1)   — llama-3.1-8b-instant
//   2) Google Gemini 2.5 Flash (GEMINI_API_KEY)
//   3) Groq (GROQ_API_KEY_2)   — llama-3.1-8b-instant
//
// Caches the result in customers.ai_insight, keyed by sha256(amount|status|due_date).
// Returns cached value unless `force=true` is sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

interface Body {
  customerId?: string;
  name: string;
  amount: number;
  status: string;
  due_date: string | null;
  force?: boolean;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM = "You are a concise financial advisor. Produce ONE short sentence (max 22 words) with a concrete next-step nudge for the business owner about this customer's payment. No greetings, no headings.";

function prompt(b: Body) {
  return `Customer: ${b.name}\nAmount: ₹${b.amount}\nStatus: ${b.status}\nDue date: ${b.due_date ?? "n/a"}`;
}

async function callGroq(apiKey: string, b: Body): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      max_tokens: 80,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt(b) },
      ],
    }),
  });
  if (!r.ok) throw new Error(`groq ${r.status}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGemini(apiKey: string, b: Body): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt(b) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 80 },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = (await req.json()) as Body;
    const hash = await sha256(`${b.amount}|${b.status}|${b.due_date ?? ""}`);

    // Auth context (RLS) — used to read/write the cached insight on the user's customer row.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    if (b.customerId && !b.force) {
      const { data } = await supabase
        .from("customers")
        .select("ai_insight, ai_insight_hash")
        .eq("id", b.customerId)
        .maybeSingle();
      if (data?.ai_insight && data.ai_insight_hash === hash) {
        return new Response(JSON.stringify({ ok: true, text: data.ai_insight, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const chain: Array<[string, (k: string, b: Body) => Promise<string>]> = [
      ["groq1", (k) => callGroq(k, b)],
      ["gemini", (k) => callGemini(k, b)],
      ["groq2", (k) => callGroq(k, b)],
    ];
    const keys: Record<string, string | undefined> = {
      groq1: Deno.env.get("GROQ_API_KEY_1"),
      gemini: Deno.env.get("GEMINI_API_KEY"),
      groq2: Deno.env.get("GROQ_API_KEY_2"),
    };

    let text = "";
    let used = "";
    let lastErr: unknown;
    for (const [name, fn] of chain) {
      const key = keys[name];
      if (!key) continue;
      try {
        text = await fn(key, b);
        if (text) { used = name; break; }
      } catch (e) { lastErr = e; }
    }
    if (!text) throw new Error(`All AI providers failed: ${lastErr instanceof Error ? lastErr.message : "no keys configured"}`);

    if (b.customerId) {
      await supabase
        .from("customers")
        .update({
          ai_insight: text,
          ai_insight_hash: hash,
          ai_insight_provider: used,
          ai_insight_updated_at: new Date().toISOString(),
        })
        .eq("id", b.customerId);
    }

    return new Response(JSON.stringify({ ok: true, text, cached: false, provider: used }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
