# Invoice Flow

Track pending payments and send Email / WhatsApp / SMS reminders with a one-tap UPI pay link.

**Stack**: React 19 + Vite SPA · Tailwind v4 · Supabase (Auth + Postgres + Edge Functions) · Firebase Hosting

---

## Local development

```bash
bun install
cp .env.example .env   # then fill the two Supabase values
bun run dev            # http://localhost:8080
```

`.env` only contains **public** values (Vite inlines them into the browser bundle).
All real secrets live in Supabase → Project Settings → **Edge Functions → Secrets**.

---

## One-time Supabase setup

1. **Run the schema** — paste `SUPABASE_SCHEMA.sql` into the SQL Editor and run it (idempotent).
2. **Enable extensions** — Database → Extensions → enable `pg_cron` and `pg_net`.
3. **Auth providers** — Authentication → Providers → enable **Email** and **Google**.
4. **URL Configuration** — add `http://localhost:8080` and your Firebase URL to _Site URL_ + _Redirect URLs_.
5. **Storage** — the schema creates the private `User_uploads` bucket (15 MB cap, RLS scoped to `{userId}/...`).
6. **Edge Function secrets** — Project Settings → Edge Functions → Secrets, add:
   - `GROQ_API_KEY_1`, `GROQ_API_KEY_2` — primary + fallback Groq keys
   - `GEMINI_API_KEY` — Google Gemini 2.5 Flash (middle fallback)
   - `EMAILJS_SERVICE_ID`, `EMAILJS_CONTACT_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` — for "Contact Developer"
   - `CRON_SECRET` — any long random string; also goes into the cron job below
7. **Deploy edge functions** (Supabase CLI):
   ```bash
   supabase functions deploy send-email
   supabase functions deploy ai-insight
   supabase functions deploy contact-developer
   supabase functions deploy automate-reminders --no-verify-jwt
   ```
   `automate-reminders` is invoked by pg_cron with its own header secret, so JWT is disabled for it.
8. **Schedule the cron job** — uncomment the `cron.schedule(...)` block at the bottom of `SUPABASE_SCHEMA.sql`, replace `<PROJECT_REF>` and `<CRON_SECRET>`, and run it. It fires every minute; once the user's local `automation_time` has passed, it sends due reminder emails directly through the saved Gmail SMTP settings and records exact skip/send/error details in `activity_logs`.

---

## Deploy to Firebase Hosting

```bash
npm i -g firebase-tools     # once
firebase login              # once
firebase use --add          # select your Firebase project (updates .firebaserc)
bun run build               # outputs dist/
firebase deploy --only hosting
```

`firebase.json` rewrites every route to `/index.html` so React Router deep links work after refresh.

### Why secrets are safe

The browser bundle only contains the two `VITE_SUPABASE_*` public values. Every secret (AI keys, EmailJS private key, cron secret, every user's Gmail App Password) stays in Supabase — fetched at request time inside an edge function.

---

## Uploading the App Tour video

1. Open Supabase → Storage → bucket `User_uploads`, create a folder named `public/`.
2. Upload your `.mp4` there and make the file public (Storage → object → "Make public").
3. Copy the public URL and set `VITE_APP_TOUR_VIDEO_URL` in `.env`.
4. `bun run build && firebase deploy --only hosting`.

---

## AI insight cache behavior

- The first time you open a customer card the edge function calls Groq → Gemini → Groq and stores the result in `customers.ai_insight` along with a sha256 hash of `(amount|status|due_date)`.
- On reload, the cached value is shown immediately — no AI call.
- The cache is invalidated automatically when any of those three fields change, **or** when you click the circular refresh icon at the top right of the AI Insight box.
