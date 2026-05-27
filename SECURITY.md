# Invoice Flow — Security Mechanisms

> A money-handling app needs defense-in-depth. This document enumerates every
> security mechanism in use so reviewers (and you) can audit at a glance.

## 1. Identity & Authentication
- **Supabase Auth** (email/password + Google OAuth) is the single identity provider.
- **JWT verification** on every edge function via `supabase.auth.getClaims(token)` — no client-side trust.
- **Password reset flow** uses Supabase magic links, scoped to `/reset-password`.
- **CompanyNameGate** ensures OAuth users complete profile before accessing the app.

## 2. Authorization — Row Level Security (RLS)
Every table in `public` has RLS enabled. Policies are scoped by `auth.uid()`:
- `profiles`               → user can read/update only their own row.
- `customers`              → user can CRUD only rows where `user_id = auth.uid()`.
- `notifications_sent`     → same scoping; append-only via INSERT policy.
- `activity_logs`          → INSERT-only by owner; admin role required to SELECT.
- `uploaded_files`         → owner-only read/write.
- `visitor_logs`           → INSERT for `anon`/`authenticated`, no SELECT.
- `user_roles`             → never readable from the client; consulted via the
  `public.has_role(uid, role)` SECURITY DEFINER function (prevents recursive RLS).
- Roles live in a **separate `user_roles` table** — never on `profiles` — to
  prevent privilege escalation by `UPDATE profiles SET role='admin'`.

## 3. Secrets handling
| Secret | Where it lives | Never goes to browser |
|---|---|---|
| `GROQ_API_KEY_1/2`, `GEMINI_API_KEY` | Supabase Edge Function Secrets | ✅ |
| `EMAILJS_PRIVATE_KEY`, `EMAILJS_SERVICE_ID`, `*_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` | Supabase Edge Function Secrets | ✅ |
| `CRON_SECRET` | Supabase Edge Function Secrets (validated by `automate-reminders` via `x-cron-secret` header) | ✅ |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env` / build env — **public by design**, RLS enforces access | n/a |
| Gmail App Password | Stored in `profiles.smtp_app_password` (per-user RLS-protected row) | Hidden behind 👁 toggle in UI |
| UPI ID | Stored in `profiles.upi_id` | Hidden behind 👁 toggle in UI |

The browser bundle contains **only** publishable values (`anon` key, project URL).

## 4. Edge function hardening
- **CORS** — wildcard `Access-Control-Allow-Origin` with explicit
  `Vary: Origin`, `Max-Age: 86400`. CORS headers attached to every response
  (success, validation error, server error).
- **OPTIONS preflight** handled before any logic.
- **Input validation** — schema-guard on body (`smtp.user`, `smtp.password`,
  `to_email`, `subject` required and typed; rejected before any network I/O).
- **No raw SQL** — only typed `supabase-js` queries; never `rpc('execute_sql')`.
- **Outbound surface** — `send-email` only opens an authenticated SMTP socket
  to the user-provided host; `contact-developer` only POSTs to EmailJS REST.
- **`automate-reminders`** is the *only* function callable without a user JWT;
  it requires the `x-cron-secret` header that matches the `CRON_SECRET`
  edge-function secret, set in pg_cron.

## 5. Client-side input validation
- Phone numbers: **10-digit local + ISO country code**, auto-detected via
  `Intl.DateTimeFormat().resolvedOptions().locale`. Anything else is rejected.
- Email: RFC-shaped regex + `<= 255` chars.
- Amounts: numeric, non-negative, capped at 1e9.
- Names: `<= 100` chars, trimmed.
- No `dangerouslySetInnerHTML` anywhere — all rendered content is escaped by React.
- External URLs always built with `URLSearchParams` / `encodeURIComponent`.

## 6. File uploads (`UploadExcel.tsx`)
- 15 MB hard cap.
- Stored in the **private** bucket `User_uploads` under `<user_id>/<timestamp>-<safe-name>`.
- Filename sanitised: `/[^\w.\-]+/g → _`.
- Phone numbers in imported rows revalidated and silently dropped if invalid.

## 7. Money / UPI safeguards
- UPI link built with `URLSearchParams` to prevent injection.
- Amount embedded directly in the UPI link (`am=<amount>`) so the customer's
  UPI app shows the exact value — no manual entry possible.
- "Click here to pay now" CTA is rendered as plain text + link; no markdown
  injection vector.
- UPI ID hidden behind 👁 toggle in `TemplatesDialog` to prevent shoulder-surfing.

## 8. Audit trail
- `activity_logs` — every meaningful user action (settings save, send,
  automation run, AI insight regeneration) is logged with `user_id`, `action`,
  `details` JSON, and timestamp.
- `notifications_sent` — every email / WhatsApp / SMS send recorded with
  channel and customer reference.
- `uploaded_files` — every Excel upload tracked with row count and storage path.

## 9. Transport & deploy
- HTTPS enforced by Firebase Hosting (HSTS via Firebase defaults).
- Supabase Edge Functions are HTTPS-only.
- CSP-friendly: no inline `<script>` (except the Vite entry tag emitted at build).

## 10. Frontend hardening
- React Router protected routes via `<Protected>` wrapper around `/dashboard`.
- Single-source `useAuth` hook — no scattered session reads from `localStorage`.
- Forced light color scheme to prevent OS-level dark-mode rendering bugs that
  could obscure amounts/CTAs.

---

## CORS error troubleshooting
If you see:
```
Access to fetch at 'https://<your-project>.supabase.co/functions/v1/send-email'
from origin 'https://invoice-flow-mvp.web.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The CORS headers ARE set in `_shared/cors.ts` (wildcard origin). When this
message appears the underlying cause is almost always **the URL itself fails
to resolve** — e.g. `projrct-id.supabase.co` is a typo, the project was
deleted, or the function wasn't deployed. The browser then surfaces a CORS
error because the failed response carries no headers.

Checklist:
1. `VITE_SUPABASE_URL` in your build env is set to your **real** project URL
   (Project Settings → API → Project URL). Re-run `bun run build` and re-deploy.
2. The function is deployed: `supabase functions deploy send-email`.
3. Hit it directly: `curl -i -X OPTIONS https://<project>.supabase.co/functions/v1/send-email`
   — you should see `access-control-allow-origin: *`.

## Files you can safely edit manually (text/UI only)
- `index.html` — title, meta description, theme-color, favicon
- `public/favicon.svg` — favicon artwork
- `src/components/AnnouncementBanner.tsx` — top banner text
- `src/components/FooterLegal.tsx` — footer links / copyright
- `src/components/AppGuideDialog.tsx` — App Guide text (3 views: home / smtp / workflow)
- `src/components/DraggableTourCard.tsx` — title bar text
- `src/components/AutomateDialog.tsx` — button + helper text
- `src/components/SettingsDialog.tsx` — labels & helper text
- `src/components/TemplatesDialog.tsx` — labels & helper text
- `src/components/ContactDeveloperDialog.tsx` — contact form copy
- `src/components/FeedbackDialog.tsx` — feedback copy
- `src/components/CompanyNameGate.tsx` — first-run prompt
- `src/components/UserCard.tsx` — per-customer card UI text
- `src/components/CustomersTable.tsx` — table headers & tooltips
- `src/components/ChartSummary.tsx` — stat labels
- `src/components/ManualAddForm.tsx` — labels & placeholders
- `src/components/UploadExcel.tsx` — helper text
- `src/lib/templates.ts` — DEFAULT_EMAIL_*, DEFAULT_SMS, DEFAULT_WHATSAPP

Always rebuild + redeploy after edits: `bun run build && firebase deploy --only hosting`.
