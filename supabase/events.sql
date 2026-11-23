-- ═══════════════════════════════════════════════════════════════════════
--  BAYAAN — event registrations (workshop, Bayaan MUN, …)
--  Includes seat caps per committee (event_committee_caps; Bayaan MUN = 30).
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

-- class section (e.g. BCS-3A), added after launch. Nullable so the rows taken
-- before it existed stay valid; the form itself requires it.
alter table public.event_registrations add column if not exists section text;
alter table public.event_registrations drop constraint if exists ev_section_len;
alter table public.event_registrations
  add constraint ev_section_len check (section is null or char_length(trim(section)) between 1 and 20);

-- WhatsApp + committee preferences, added for Bayaan MUN (27 Nov 2026). Only
-- events with a `committees` list in BAYAAN.events.list ask for them; every
-- other event leaves them null, and so do all the rows taken before they existed.
alter table public.event_registrations add column if not exists phone       text;
alter table public.event_registrations add column if not exists committee_1 text;
alter table public.event_registrations add column if not exists committee_2 text;
alter table public.event_registrations add column if not exists committee_3 text;
alter table public.event_registrations drop constraint if exists ev_phone_len;
alter table public.event_registrations
  add constraint ev_phone_len check (phone is null or char_length(trim(phone)) between 7 and 24);
alter table public.event_registrations drop constraint if exists ev_committee_len;
alter table public.event_registrations
  add constraint ev_committee_len check (
        (committee_1 is null or char_length(committee_1) <= 60)
    and (committee_2 is null or char_length(committee_2) <= 60)
    and (committee_3 is null or char_length(committee_3) <= 60));

alter table public.event_registrations enable row level security;

-- ─────────────────────────────────────────────────────────────────────
--  PRIVILEGES — column level, same idea as `registrations`
-- ─────────────────────────────────────────────────────────────────────
revoke all on public.event_registrations from anon, authenticated;

grant insert (event, full_name, roll_no, section, email, proof_path,
              phone, committee_1, committee_2, committee_3)
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

-- ─────────────────────────────────────────────────────────────────────
--  SEAT CAPS PER COMMITTEE (added 2026-11-23 for Bayaan MUN: 30 a committee)
--  A row here caps how many registrations one committee of that event can
--  hold. A registration takes a seat in its `committee_1`; `pending` and
--  `verified` rows hold one, `rejected` rows free it. Events with no row here
--  are not capped. The trigger is the authority — the popup only mirrors it.
--  Change a cap:  update public.event_committee_caps set per_committee = 40
--                 where event = 'bayaan-mun';
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.event_committee_caps (
  event         text primary key,
  per_committee int  not null check (per_committee between 1 and 1000)
);
alter table public.event_committee_caps enable row level security;
revoke all on public.event_committee_caps from anon, authenticated;
grant select on public.event_committee_caps to authenticated;
drop policy if exists "admins may read committee caps" on public.event_committee_caps;
create policy "admins may read committee caps"
  on public.event_committee_caps for select to authenticated
  using (public.is_admin());

insert into public.event_committee_caps (event, per_committee) values ('bayaan-mun', 30)
on conflict (event) do update set per_committee = excluded.per_committee;

-- Refuses the registration that would go over the cap. SECURITY DEFINER because
-- the public cannot read the table it has to count. The advisory lock makes two
-- people racing for the last seat queue up, so the cap cannot be overshot.
-- Also guards an admin moving a rejected row back to pending/verified.
create or replace function public.event_registrations_seat_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   int;
  v_taken int;
begin
  if new.committee_1 is null or new.status = 'rejected' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'rejected'
     and old.committee_1 is not distinct from new.committee_1 then
    return new;                         -- already holds this seat
  end if;

  select per_committee into v_cap from event_committee_caps where event = new.event;
  if v_cap is null then
    return new;                         -- this event is not capped
  end if;

  perform pg_advisory_xact_lock(hashtext('seat:' || new.event || ':' || new.committee_1));

  select count(*) into v_taken
    from event_registrations
   where event = new.event
     and committee_1 = new.committee_1
     and status <> 'rejected'
     and (tg_op = 'INSERT' or id <> new.id);

  if v_taken >= v_cap then
    -- js/events.js looks for the word committee_full in this message
    raise exception 'committee_full: % is full (% seats)', new.committee_1, v_cap
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists event_registrations_seat_check on public.event_registrations;
create trigger event_registrations_seat_check
  before insert or update of status, committee_1 on public.event_registrations
  for each row execute function public.event_registrations_seat_check();

-- What the popup reads to grey out full committees: the cap and the seats taken
-- per committee, as {"seats":30,"taken":{"PNA":4,...}} — null for an uncapped
-- event. Counts only, never names, so it is safe for anyone to call.
create or replace function public.event_committee_seats(p_event text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when c.event is null then null else jsonb_build_object(
           'seats', c.per_committee,
           'taken', coalesce((
              select jsonb_object_agg(t.committee_1, t.n)
                from (select committee_1, count(*) as n
                        from event_registrations
                       where event = p_event and status <> 'rejected' and committee_1 is not null
                       group by committee_1) t), '{}'::jsonb))
         end
    from (select p_event as e) x
    left join event_committee_caps c on c.event = x.e;
$$;

revoke all on function public.event_committee_seats(text) from public;
grant execute on function public.event_committee_seats(text) to anon, authenticated;
