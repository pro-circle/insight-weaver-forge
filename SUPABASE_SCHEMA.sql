-- ============================================================
-- Invoice Flow — Supabase Schema (v3)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. PROFILES (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  company_name text,
  phone text,
  upi_id text,
  payee_name text,
  enable_upi boolean default true,
  -- Gmail SMTP (16-char app password)
  smtp_host text default 'smtp.gmail.com',
  smtp_port integer default 465,
  smtp_user text,
  smtp_app_password text,
  -- Editable templates ({{double_braces}})
  email_subject_template text,
  email_body_template text,
  whatsapp_template text,
  sms_template text,
  -- In-browser automation
  automation_enabled boolean default false,
  automation_time text,             -- "HH:MM" 24h, sender's local time
  automation_last_run_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migrate existing installations
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists smtp_host text default 'smtp.gmail.com';
alter table public.profiles add column if not exists smtp_port integer default 465;
alter table public.profiles alter column smtp_port set default 465;
update public.profiles set smtp_port = 465 where coalesce(smtp_host, 'smtp.gmail.com') = 'smtp.gmail.com' and coalesce(smtp_port, 587) = 587;
alter table public.profiles add column if not exists smtp_user text;
alter table public.profiles add column if not exists smtp_app_password text;
alter table public.profiles add column if not exists email_subject_template text;
alter table public.profiles add column if not exists email_body_template text;
alter table public.profiles add column if not exists whatsapp_template text;
alter table public.profiles add column if not exists sms_template text;
alter table public.profiles add column if not exists automation_enabled boolean default false;
alter table public.profiles add column if not exists automation_time text;
alter table public.profiles add column if not exists automation_last_run_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
-- Drop legacy EmailJS columns (kept as no-op if absent)
alter table public.profiles drop column if exists emailjs_service_id;
alter table public.profiles drop column if exists emailjs_template_id;
alter table public.profiles drop column if exists emailjs_public_key;

-- 2. CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('paid','pending','overdue')),
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists customers_user_id_idx on public.customers(user_id);

-- 3. ACTIVITY LOGS
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists activity_user_idx on public.activity_logs(user_id);

-- 4. NOTIFICATIONS SENT
create table if not exists public.notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp','sms')),
  status text default 'sent',
  message text,
  created_at timestamptz default now()
);
alter table public.notifications_sent add column if not exists message text;

-- 4b. EMAIL QUEUE (server-side automation worker)
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  recipient text not null,
  subject text not null,
  body text not null,
  from_name text not null,
  smtp_host text default 'smtp.gmail.com',
  smtp_port integer default 465,
  smtp_user text not null,
  smtp_app_password text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  idempotency_key text not null unique,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant all on public.email_queue to service_role;
create index if not exists email_queue_pending_idx on public.email_queue(status, scheduled_for, created_at);
create index if not exists email_queue_user_idx on public.email_queue(user_id);

-- 5. VISITOR LOGS
create table if not exists public.visitor_logs (
  id uuid primary key default gen_random_uuid(),
  path text,
  user_agent text,
  created_at timestamptz default now()
);

-- 6. APP EVENTS
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 7. UPLOADED FILES (metadata; binary lives in Storage)
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  path text not null,
  filename text,
  size_bytes bigint,
  mime_type text,
  rows_imported integer,
  created_at timestamptz default now()
);
create index if not exists uploaded_files_user_idx on public.uploaded_files(user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (carries name + company from metadata)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'company_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.customers           enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.notifications_sent  enable row level security;
alter table public.email_queue         enable row level security;
alter table public.visitor_logs        enable row level security;
alter table public.app_events          enable row level security;
alter table public.uploaded_files      enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "customers_all_own" on public.customers;
create policy "customers_all_own" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "activity_insert_own" on public.activity_logs;
drop policy if exists "activity_select_own" on public.activity_logs;
create policy "activity_insert_own" on public.activity_logs for insert with check (auth.uid() = user_id);
create policy "activity_select_own" on public.activity_logs for select using (auth.uid() = user_id);

drop policy if exists "notif_all_own" on public.notifications_sent;
create policy "notif_all_own" on public.notifications_sent
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "visitor_insert_any" on public.visitor_logs;
create policy "visitor_insert_any" on public.visitor_logs for insert with check (true);

drop policy if exists "app_events_all_own" on public.app_events;
create policy "app_events_all_own" on public.app_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "uploaded_files_all_own" on public.uploaded_files;
create policy "uploaded_files_all_own" on public.uploaded_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Legacy feedback table no longer used (feedback now via Google Form + EmailJS to dev)
drop table if exists public.feedback;

-- ============================================================
-- STORAGE BUCKET: "User_uploads" (private; owner-only)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('User_uploads', 'User_uploads', false, 15728640)  -- 15 MB cap
on conflict (id) do update set file_size_limit = 15728640;

-- Policy: users can read/write only their own folder ({userId}/...)
drop policy if exists "user_uploads_read_own"   on storage.objects;
drop policy if exists "user_uploads_insert_own" on storage.objects;
drop policy if exists "user_uploads_update_own" on storage.objects;
drop policy if exists "user_uploads_delete_own" on storage.objects;

create policy "user_uploads_read_own" on storage.objects for select
  using (bucket_id = 'User_uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user_uploads_insert_own" on storage.objects for insert
  with check (bucket_id = 'User_uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user_uploads_update_own" on storage.objects for update
  using (bucket_id = 'User_uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user_uploads_delete_own" on storage.objects for delete
  using (bucket_id = 'User_uploads' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- DONE. In Supabase Dashboard:
--   • Authentication → Providers → enable Email + Google
--   • Authentication → URL Configuration → site URL = http://localhost:3000
-- ============================================================

-- ============================================================
-- v4 ADDITIONS — AI insight cache + automation timezone + cron
-- ============================================================
alter table public.customers add column if not exists ai_insight text;
alter table public.customers add column if not exists ai_insight_hash text;
alter table public.customers add column if not exists ai_insight_provider text;
alter table public.customers add column if not exists ai_insight_updated_at timestamptz;
alter table public.profiles  add column if not exists timezone text default 'Asia/Kolkata';

-- ============================================================
-- pg_cron schedule for the automate-reminders edge function.
-- 1) Enable extensions (once, in Database → Extensions, or via SQL):
--      create extension if not exists pg_cron;
--      create extension if not exists pg_net;
-- 2) Replace <PROJECT_REF> with your Supabase project ref and <CRON_SECRET>
--    with the value you set in Edge Functions → Secrets.
-- ============================================================
-- select cron.schedule(
--   'invoice-flow-automation',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/automate-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', '<CRON_SECRET>'
--     ),
--     body := '{}'::jsonb
--   ) as request_id;
--   $$
-- );
