-- ═══════════════════════════════════════════════════════════════════════
--  BAYAAN — broadcasts (room announcements + certificates)
--  Run AFTER schema.sql and events.sql. Safe to re-run.
--
--  An admin queues a row here from the admin board's Broadcast tab; the Google
--  Apps Script (automation/confirmation-emails.gs) picks it up every few
--  minutes and emails every VERIFIED registrant of that event. Nothing in this
--  file sends mail — it only records who asked for what, and who got it.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.broadcasts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),

  event      text not null,                       -- key from BAYAAN.events.list
  kind       text not null,                       -- 'message' | 'certificate'
  subject    text not null,
  body       text,
  test_to    text,                                -- set → send ONE sample there, to nobody else

  -- progress, written by the script (service role), never by the browser
  status       text not null default 'queued',
  total        integer,
  sent_count   integer not null default 0,
  failed_count integer not null default 0,
  error        text,
  done_at      timestamptz,

  constraint bc_event_len   check (char_length(trim(event))   between 2 and 40),
  constraint bc_kind_known  check (kind in ('message', 'certificate')),
  constraint bc_subject_len check (char_length(trim(subject)) between 3 and 150),
  constraint bc_body_len    check (body is null or char_length(body) <= 3000),
  constraint bc_test_shape  check (test_to is null or test_to ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint bc_status_known check (status in ('queued', 'sending', 'done', 'failed'))
);

create index if not exists broadcasts_created_at_idx on public.broadcasts (created_at desc);

-- one row per person per broadcast: this is what stops anybody being mailed twice.
-- `ok = false` rows are people the script could not mail; they are not retried
-- automatically (a permanently bad address would otherwise stall the whole send).
create table if not exists public.broadcast_deliveries (
  broadcast_id    uuid not null references public.broadcasts(id) on delete cascade,
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  ok              boolean not null default true,
  error           text,
  sent_at         timestamptz not null default now(),
  primary key (broadcast_id, registration_id)
);

alter table public.broadcasts           enable row level security;
alter table public.broadcast_deliveries enable row level security;

revoke all on public.broadcasts           from anon, authenticated;
revoke all on public.broadcast_deliveries from anon, authenticated;

-- admins may queue a broadcast and read the history; they cannot touch progress columns
grant select on public.broadcasts to authenticated;
grant insert (event, kind, subject, body, test_to) on public.broadcasts to authenticated;

drop policy if exists "admins may read broadcasts" on public.broadcasts;
create policy "admins may read broadcasts"
  on public.broadcasts for select to authenticated
  using (public.is_admin());

drop policy if exists "admins may queue broadcasts" on public.broadcasts;
create policy "admins may queue broadcasts"
  on public.broadcasts for insert to authenticated
  with check (public.is_admin() and status = 'queued');

-- broadcast_deliveries has no policy and no grant on purpose: only the script's
-- service-role key (which bypasses RLS) ever reads or writes it.
-- There is no update or delete grant on broadcasts either.
