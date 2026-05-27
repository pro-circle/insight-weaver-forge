// Shared CORS for edge functions called from the browser.
// Wildcard origin so the app works from localhost (dev), <project>.web.app
// (Firebase Hosting), and any custom domain without rebuilding the function.
//
// IMPORTANT: every response — including errors and the OPTIONS preflight —
// MUST include these headers, otherwise the browser blocks the response and
// the caller sees a generic CORS error with no useful details.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};
