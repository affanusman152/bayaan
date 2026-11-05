-- ═══════════════════════════════════════════════════════════════════════
--  BAYAAN — MUN delegations (first use: BZU MUN, Nov 2026)
--  Run AFTER schema.sql (public.is_admin()) and events.sql (the private
--  `payment-proofs` bucket and the verified_at stamp trigger function).
--  Run once, whole, in the Supabase SQL editor. Safe to re-run.
--
--  The form is mun.html — NOT linked from the site, reached only through its
--  link. The delegation head enters every member (themselves first) and
--  uploads ONE screenshot of the whole delegation's payment.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
--  ONE ROW PER DELEGATION
--  `conference` is BAYAAN.mun.key in js/data.js (e.g. 'bzu-mun'), so the next
--  MUN reuses these tables with a new key instead of a migration.
--  head_* is copied from delegate #1 so the admin list reads without a join.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.mun_delegations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  conference text not null,
  head_name  text not null,
  head_email text not null,
  head_phone text not null,
  delegate_count   int not null,
  fee_per_delegate int not null,         -- set by submit_mun_delegation(), never by the browser
  total_pkr        int not null,         -- delegate_count × fee_per_delegate
  proof_path text not null,              -- object path inside the payment-proofs bucket

  -- set by the council (see the grants below)
  status      text not null default 'pending',
  notes       text,
  verified_at timestamptz,               -- stamped by the trigger below

  constraint mund_conference_len check (char_length(trim(conference)) between 2 and 40),
  constraint mund_count_range    check (delegate_count between 1 and 30),
  constraint mund_total_matches  check (total_pkr = delegate_count * fee_per_delegate),
  constraint mund_proof_len      check (char_length(proof_path) between 5 and 200),
  constraint mund_status_known   check (status in ('pending','verified','rejected'))
);

create index if not exists mun_delegations_created_at_idx
  on public.mun_delegations (created_at desc);

-- ─────────────────────────────────────────────────────────────────────
--  ONE ROW PER DELEGATE (the head is position 1)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.mun_delegates (
  id            uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.mun_delegations (id) on delete cascade,
  conference    text not null,           -- copied from the delegation, for the unique index
  position      smallint not null,       -- 1 = delegation head

  full_name   text not null,
  roll_no     text not null,
  section     text not null,
  email       text not null,
  phone       text not null,
  committee_1 text not null,
  committee_2 text,
  committee_3 text,
  experience  text not null,             -- 'none' | '1-2' | '3+' conferences before

  constraint mun_pos_range      check (position between 1 and 30),
  constraint mun_full_name_len  check (char_length(trim(full_name)) between 2 and 80),
  constraint mun_roll_no_len    check (char_length(trim(roll_no))   between 3 and 24),
  constraint mun_section_len    check (char_length(trim(section))   between 1 and 20),
  constraint mun_email_shape    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint mun_phone_len      check (char_length(trim(phone))     between 7 and 24),
  constraint mun_committee_len  check (char_length(trim(committee_1)) between 2 and 60
                                   and (committee_2 is null or char_length(committee_2) <= 60)
                                   and (committee_3 is null or char_length(committee_3) <= 60)),
  constraint mun_experience_known check (experience in ('none','1-2','3+')),
  constraint mun_delegation_position_key unique (delegation_id, position)
);

-- a student can be in only ONE delegation per conference — stops the same
-- person being sent (and charged) twice by two different heads
create unique index if not exists mun_delegates_roll_conf_key
  on public.mun_delegates (conference, lower(trim(roll_no)));

create index if not exists mun_delegates_delegation_idx
  on public.mun_delegates (delegation_id);

-- verified_at: the same stamp as event_registrations (function from events.sql)
drop trigger if exists mun_delegations_stamp on public.mun_delegations;
create trigger mun_delegations_stamp
  before update on public.mun_delegations
  for each row execute function public.event_registrations_stamp();

alter table public.mun_delegations enable row level security;
alter table public.mun_delegates   enable row level security;

-- ─────────────────────────────────────────────────────────────────────
--  PRIVILEGES — the public cannot touch either table directly.
--  It can only call submit_mun_delegation() below, which writes the
--  delegation and all its members in one transaction (all or nothing).
-- ─────────────────────────────────────────────────────────────────────
revoke all on public.mun_delegations from anon, authenticated;
revoke all on public.mun_delegates   from anon, authenticated;

grant select on public.mun_delegations to authenticated;
grant select on public.mun_delegates   to authenticated;
grant update (status, notes) on public.mun_delegations to authenticated;

drop policy if exists "admins may read mun delegations" on public.mun_delegations;
create policy "admins may read mun delegations"
  on public.mun_delegations for select to authenticated
  using (public.is_admin());

drop policy if exists "admins may triage mun delegations" on public.mun_delegations;
create policy "admins may triage mun delegations"
  on public.mun_delegations for update to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins may read mun delegates" on public.mun_delegates;
create policy "admins may read mun delegates"
  on public.mun_delegates for select to authenticated
  using (public.is_admin());

-- no insert policies (the function is the only way in), no delete anywhere.

-- ─────────────────────────────────────────────────────────────────────
--  THE SUBMIT FUNCTION — called by mun.html as POST /rest/v1/rpc/submit_mun_delegation
--  SECURITY DEFINER so it can write past the revokes above; it therefore
--  re-checks everything itself. The fee lives HERE, not in the browser:
--  keep it in step with BAYAAN.mun.fee in js/data.js (display only).
--  Errors: 22023 → HTTP 400 with a readable message; 23505 → HTTP 409.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.submit_mun_delegation(
  conference text,
  proof_path text,
  delegates  jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee   constant int := 1000;          -- PKR per delegate (BZU MUN: 1,500 + 400 delegation fee, waived to 1,000)
  v_conf  text := lower(trim(conference));
  v_n     int;
  v_id    uuid;
  v_dup   text;
  d       jsonb;
  i       int := 0;
begin
  if v_conf !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'Unknown conference.' using errcode = '22023';
  end if;

  if jsonb_typeof(delegates) is distinct from 'array' then
    raise exception 'The delegate list is missing.' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(delegates);
  if v_n < 1 or v_n > 30 then
    raise exception 'A delegation has 1 to 30 delegates.' using errcode = '22023';
  end if;

  -- the screenshot must already be uploaded, under mun/, and not claimed by another delegation
  if proof_path !~ '^mun/[A-Za-z0-9-]{8,64}\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o
                    where o.bucket_id = 'payment-proofs' and o.name = proof_path)
     or exists (select 1 from public.mun_delegations m where m.proof_path = submit_mun_delegation.proof_path) then
    raise exception 'The payment screenshot did not upload. Please attach it again.' using errcode = '22023';
  end if;

  -- the same roll number twice in one submission
  select r into v_dup
    from (select lower(trim(x->>'roll_no')) r from jsonb_array_elements(delegates) x) s
   group by r having count(*) > 1 limit 1;
  if v_dup is not null then
    raise exception 'Roll number % is listed twice.', upper(v_dup) using errcode = '22023';
  end if;

  -- already in another delegation — say which one, so the head can fix it
  select m.roll_no into v_dup
    from public.mun_delegates m
    join jsonb_array_elements(delegates) x on lower(trim(x->>'roll_no')) = lower(trim(m.roll_no))
   where m.conference = v_conf
   limit 1;
  if v_dup is not null then
    raise exception 'Roll number % is already registered in a delegation.', upper(trim(v_dup)) using errcode = '23505';
  end if;

  d := delegates->0;
  insert into public.mun_delegations
    (conference, head_name, head_email, head_phone, delegate_count, fee_per_delegate, total_pkr, proof_path)
  values
    (v_conf, trim(d->>'full_name'), lower(trim(d->>'email')), trim(d->>'phone'),
     v_n, v_fee, v_n * v_fee, proof_path)
  returning id into v_id;

  -- the table constraints do the per-field checks; a bad field aborts the whole submission
  for d in select * from jsonb_array_elements(delegates) loop
    i := i + 1;
    insert into public.mun_delegates
      (delegation_id, conference, position, full_name, roll_no, section, email, phone,
       committee_1, committee_2, committee_3, experience)
    values
      (v_id, v_conf, i,
       trim(d->>'full_name'), trim(d->>'roll_no'), upper(trim(d->>'section')),
       lower(trim(d->>'email')), trim(d->>'phone'),
       trim(d->>'committee_1'), nullif(trim(d->>'committee_2'), ''), nullif(trim(d->>'committee_3'), ''),
       d->>'experience');
  end loop;
end;
$$;

revoke all on function public.submit_mun_delegation(text, text, jsonb) from public;
grant execute on function public.submit_mun_delegation(text, text, jsonb) to anon, authenticated;

-- The screenshot goes to the existing private `payment-proofs` bucket (events.sql),
-- under mun/. Its upload / admin-read policies already cover it; nothing to add.
