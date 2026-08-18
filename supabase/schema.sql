-- ═══════════════════════════════════════════════════════════════════════
--  BAYAAN — induction registrations
--  Run this ONCE, whole, in the Supabase SQL editor.
--  Safe to re-run: everything is `if not exists` / `drop policy if exists`.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
--  WHO COUNTS AS AN ADMIN
--  Membership of this table is what grants read access — deliberately NOT
--  "any logged-in user". If public sign-ups are ever left switched on, the
--  looser rule would let a stranger create an account and read every
--  applicant's phone number and email. This way an account is powerless
--  until you explicitly add its id here.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A policy on `admins` cannot query `admins` in its own USING clause — Postgres
-- detects that as infinite recursion. This security-definer function runs as
-- the table owner (which bypasses RLS), so it can check membership without
-- retriggering the policy that calls it.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins may see the admin list" on public.admins;
create policy "admins may see the admin list"
  on public.admins for select to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────
--  THE REGISTRATIONS
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.registrations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name  text not null,
  roll_no    text not null,
  email      text not null,
  phone      text not null,
  batch      text,
  department text,

  wings      text[] not null default '{}',
  experience text,
  why        text,

  -- filled in by the council, never by the applicant (see the grants below)
  status     text not null default 'new',
  notes      text,

  constraint full_name_len  check (char_length(trim(full_name)) between 2 and 80),
  constraint roll_no_len    check (char_length(trim(roll_no))   between 3 and 24),
  constraint email_shape    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint phone_len      check (char_length(trim(phone))     between 7 and 24),
  constraint wings_present  check (array_length(wings, 1) >= 1),
  constraint experience_len check (experience is null or char_length(experience) <= 800),
  constraint why_len        check (why        is null or char_length(why)        <= 800),
  constraint status_known   check (status in ('new','shortlisted','accepted','rejected'))
);

-- one registration per roll number; the form turns the resulting 409 into
-- "you have already registered with this roll number"
create unique index if not exists registrations_roll_no_key
  on public.registrations (lower(trim(roll_no)));

create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

alter table public.registrations enable row level security;

-- ─────────────────────────────────────────────────────────────────────
--  PRIVILEGES — column level, so the public form physically cannot write
--  to `status` or `notes` even though it is allowed to insert a row.
-- ─────────────────────────────────────────────────────────────────────
revoke all on public.registrations from anon, authenticated;

grant insert (full_name, roll_no, email, phone, batch, department, wings, experience, why)
  on public.registrations to anon, authenticated;

grant select on public.registrations to authenticated;
grant update (status, notes) on public.registrations to authenticated;

-- ─────────────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────

-- anyone may hand in a form...
drop policy if exists "anyone may register" on public.registrations;
create policy "anyone may register"
  on public.registrations for insert to anon, authenticated
  with check (true);

-- ...but only an admin may read what came in.
-- NOTE: because anon has no SELECT, the client MUST send the header
--       `Prefer: return=minimal` on insert, or PostgREST will try to return
--       the new row and fail. js/supabase.js already does this.
drop policy if exists "admins may read registrations" on public.registrations;
create policy "admins may read registrations"
  on public.registrations for select to authenticated
  using (public.is_admin());

drop policy if exists "admins may triage registrations" on public.registrations;
create policy "admins may triage registrations"
  on public.registrations for update to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- There is deliberately NO delete policy and no delete grant, so nothing can
-- destroy a submission through the API. Delete from the Supabase dashboard if
-- you ever genuinely need to.

-- ═══════════════════════════════════════════════════════════════════════
--  LAST STEP — make yourself an admin
--  1. Authentication → Users → "Add user" → create your account
--     (and turn OFF "Allow new users to sign up" under Authentication →
--      Sign In / Providers, so nobody can self-register)
--  2. Copy that user's UID and run:
--
--       insert into public.admins (user_id, email)
--       values ('PASTE-THE-UID-HERE', 'you@example.com');
--
--  Repeat for each council member who should see the submissions.
-- ═══════════════════════════════════════════════════════════════════════
