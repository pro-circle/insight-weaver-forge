## What I'll change

### 1. UPI link not included in messages — fix

- `src/pages/Dashboard.tsx` `runAutomationNow`: build `upi_link` per customer using `buildUpiLink()` (currently hard-coded `""`), gated by `profile.enable_upi && profile.upi_id && profile.payee_name`.
- `supabase/functions/automate-reminders/index.ts`: same fix server-side so the cron run also includes the UPI link in the rendered email body.

### 2. Nav order

- `src/pages/Dashboard.tsx` header: re-order to **App Guide → Templates → Settings→ History →  Feedback → Contact Developer → Sign out**.

### 3. Templates dialog polish

- `src/components/TemplatesDialog.tsx`:

- Email/WhatsApp/SMS `TabsTrigger` get the same dark-blue hover/active style used in Dashboard (`TAB_TRIGGER`).

On successful `save()` → `setOpen(false)` (auto-close).

- **Drag-and-drop variables**: replace plain `<Textarea>` with a wrapper that renders a chip row (`{{to_name}}`, `{{amount}}`, …). Each chip is `draggable`; drop on textarea inserts the variable at the drop position. Clicking a chip inserts at the cursor. We additionally prevent typing inside an existing `{{...}}` block: an `onBeforeInput` handler blocks edits whose caret falls inside a variable span — if user wants to remove a variable they select the whole `{{xxx}}` and delete it.

### 4. Replace browser popups

- Remove every `window.confirm` / `alert`. Affected files: `UserCard.tsx` (delete customer), `CustomersTable.tsx` (delete), `SettingsDialog.tsx` (any reset), `Dashboard.tsx` (sign-out).
- Introduce a reusable `<ConfirmDialog />` (shadcn AlertDialog wrapper) at `src/components/ConfirmDialog.tsx` and use it everywhere with semantic titles, e.g. **"Are you sure you want to logout?"**.

### 5. Loading skeletons

- Add `<Skeleton>` placeholders for late-loading sections (customers grid, charts, history charts) instead of empty white space — wired to a small `loading` flag local to each section.

### 6. Bold the counts

- `src/components/ChartSummary.tsx` `Stat`: wrap `count` in `<b>` (`<b>{count}</b> customer`).

### 7. New "History" entry in the nav

- New component `src/components/HistoryDialog.tsx`:
  - Trigger: `History` button in the header.
  - Dialog shows three collapsible cards: **Email**, **WhatsApp**, **SMS**.
  - Each card expands to show a small donut chart(recharts) with two slices — **Sent** (green) and **Failed** (red) — plus the raw counts. Show the section name and number of values on hover or clicking the chart section.
  - Data source: `notifications_sent` grouped by `channel` + `status` for the logged-in user (RLS-scoped).
- Schema tweak (`SUPABASE_SCHEMA.sql` + migration): `notifications_sent.status` currently defaults to `'sent'` and is free-text. Add a check constraint `status in ('sent','failed')` and start writing `'failed'` rows from `UserCard.emailReminder` and from the cron function when a send throws — so the History pie has real data.
- Store all the history an d the all the details in the supabase schema (edit sql)

### 8. Dashboard channel-frequency pie

- `src/components/ChartSummary.tsx`: alongside the existing pie, add a second pie showing **sent counts per channel** — Email (blue `#2563eb`), WhatsApp (purple `#7c3aed`), SMS (orange `#ea580c`). Only render when `email+wa+sms ≥ 1`. Counts fetched once in `Dashboard` from `notifications_sent` where `status='sent'` and passed in as a prop.

### 9. Security & wiring

- Every new DB read is RLS-scoped (existing `notif_all_own` policy already restricts to `auth.uid()=user_id`).
- No keys hard-coded; History queries go through the existing `supabase` client (anon key + JWT).
- `ConfirmDialog` actions remain client-side guards only — actual deletes still hit RLS-protected tables.
- Add server-side validation in `automate-reminders` to skip customers without a valid email and to log a `failed` row on SMTP errors so History stays accurate.

### Files touched

```
src/pages/Dashboard.tsx
src/components/TemplatesDialog.tsx
src/components/UserCard.tsx
src/components/CustomersTable.tsx
src/components/ChartSummary.tsx
src/components/ConfirmDialog.tsx          (new)
src/components/HistoryDialog.tsx          (new)
src/components/VariableTextarea.tsx       (new — drag-drop + lock {{…}})
src/lib/notify.ts                          (small: export buildUpiLinkSafe helper)
supabase/functions/automate-reminders/index.ts
SUPABASE_SCHEMA.sql                       (status check + comment)
```

### Out of scope (flag before doing)

- I will **not** rewrite the existing recharts pie color tokens into the design-system HSL palette in this pass — keeping the literal hex (`#2563eb`, `#7c3aed`, `#ea580c`) you asked for. Say the word if you want them moved into `index.css` tokens. Add the requested colour scheme only for the newly created donut chart(history) in dahboard
- Drag-and-drop variables uses a plain textarea with insert-at-caret + a `beforeinput` guard. A full contentEditable rich e ditor with true "atomic" chips is significantly more code — flag if you want that instead.

Reply **go** (or with edits) and I'll execute the whole batch.