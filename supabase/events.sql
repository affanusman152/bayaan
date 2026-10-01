-- ═══════════════════════════════════════════════════════════════════════
--  BAYAAN — event registrations (workshop + dramatics)
--  Run AFTER schema.sql (it reuses public.is_admin()).
--  Run once, whole, in the Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
--  THE REGISTRATIONS
--  `event` is a short key from BAYAAN.events.list in js/data.js
--  (e.g. 'workshop', 'dramatics'). It is deliberately not a CHECK list, so
--  adding a third event never needs a migration.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  event      text not null,
  full_name  text not null,
  roll_no    text not null,
  email      text not null,
  proof_path text not null,              -- object path inside the payment-proofs bucket

  -- set by the council, never by the applicant (see the grants below)
  status     text not null default 'pending',
  notes      text,
  verified_at          timestamptz,      -- stamped by the trigger below
  confirmation_sent_at timestamptz,      -- written by n8n (service role) after it emails

  constraint ev_event_len     check (char_length(trim(event))     between 2 and 40),
  constraint ev_full_name_len check (char_length(trim(full_name)) between 2 and 80),
  constraint ev_roll_no_len   check (char_length(trim(roll_no))   between 3 and 24),
  constraint ev_email_shape   check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint ev_proof_len     check (char_length(proof_path)      between 5 and 200),
  constraint ev_status_known  check (status in ('pending','verified','rejected'))
);

-- one registration per roll number PER EVENT; the form turns the resulting
-- 409 into "you have already registered for this event"
create unique index if not exists event_registrations_roll_event_key
  on public.event_registrations (event, lower(trim(roll_no)));

create index if not exists event_registrations_created_at_idx
  on public.event_registrations (created_at desc);

-- stamp verified_at whenever a row moves to 'verified' (and clear it if it moves away)
create or replace function public.event_registrations_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_at := now();
  elsif new.status <> 'verified' then
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists event_registrations_stamp on public.event_registrations;
create trigger event_registrations_stamp
  before update on public.event_registrations
  for each row execute function public.event_registrations_stamp();

alter table public.event_registrations enable row level security;

-- ─────────────────────────────────────────────────────────────────────
--  PRIVILEGES — column level, same idea as `registrations`
-- ─────────────────────────────────────────────────────────────────────
revoke all on public.event_registrations from anon, authenticated;

grant insert (event, full_name, roll_no, email, proof_path)
  on public.event_registrations to anon, authenticated;

grant select on public.event_registrations to authenticated;
grant update (status, notes) on public.event_registrations to authenticated;

drop policy if exists "anyone may register for an event" on public.event_registrations;
create policy "anyone may register for an event"
  on public.event_registrations for insert to anon, authenticated
  with check (status = 'pending');

-- NOTE: anon has no SELECT, so the client must send `Prefer: return=minimal`
--       on insert. js/supabase.js already does.
drop policy if exists "admins may read event registrations" on public.event_registrations;
create policy "admins may read event registrations"
  on public.event_registrations for select to authenticated
  using (public.is_admin());

drop policy if exists "admins may triage event registrations" on public.event_registrations;
create policy "admins may triage event registrations"
  on public.event_registrations for update to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- no delete policy and no delete grant, as with `registrations`.

-- ─────────────────────────────────────────────────────────────────────
--  PAYMENT SCREENSHOTS — a PRIVATE storage bucket
--  The public can upload (insert) and nothing else: no listing, no reading,
--  no overwriting. Only admins can read, and the admin board does it through
--  short-lived signed links. The bucket itself enforces size and file type, so
--  that holds even if someone bypasses js/events.js.
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "anyone may upload a payment proof" on storage.objects;
create policy "anyone may upload a payment proof"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs');

drop policy if exists "admins may read payment proofs" on storage.objects;
create policy "admins may read payment proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());
