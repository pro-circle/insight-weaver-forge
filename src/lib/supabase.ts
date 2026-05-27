import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export async function logActivity(action: string, details: Record<string, unknown> = {}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("activity_logs").insert({
      user_id: data.user.id,
      action,
      details,
    });
  } catch {
    /* noop */
  }
}
