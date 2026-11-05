# Bayaan — working notes for Claude

Bayaan is the literary & public speaking society site for FAST NUCES Multan. Static site:
**no build step, no dependencies** (`node serve.js` → http://localhost:5173). **This repo is public** —
never commit secrets. `README.md` is the detailed reference; keep it current.

## Rules
- **Update the docs in the same commit as any change** (README.md, `assets/team/README.txt`, SQL header comments).
- Commit only files you edited; check `git status` first. Ask before pushing.
- **Never ask for, read or handle the Supabase service-role / secret key.** The publishable key in `js/data.js` is public by design.
- Ask before applying anything to the **live Supabase project** (project ref `rqmolxyuvuyuluzqmrbc`; the claude.ai Supabase MCP is usually attached). Test RLS inside rollback-only `DO` blocks.
- Match the existing code style: plain JS modules in IIFEs, comments that explain *why*, palette from `css/tokens.css`.
- The user explicitly wants the email look left as it is (dark maroon-and-gold card).

## Where things are
- Content: `js/data.js` (council, ventures, wings, `BAYAAN.events`). Council photos: `assets/team/`.
- Induction form: `js/join.js` → table `registrations` (`supabase/schema.sql`).
- **Event popup** (opens on load, once per visit): `js/events.js`, `css/events.css`, `supabase/events.sql` → table `event_registrations`
  + private `payment-proofs` bucket. `BAYAAN.events.list[].hidden` keeps an event out of the popup; `includes` lists what one registration covers; `perk` is the ticket's small print.
  Form fields: name, roll no, **section** (column added 2026-10-04 — must exist on the live DB before the site that sends it), email, screenshot.
  Other doors in (all `[data-ev-open]`, hidden until events.js enables them): top-bar button, hero chip, home ticket card (`#evTicket`), drawer item, scroll-aware pill.
  `/?register` or `/#/register` force-opens it even for a browser that already registered.
- **MUN delegation form** `mun.html` + `js/mun.js` + `css/mun.css` — link-only (not linked from the site, noindex).
  `BAYAAN.mun.group: "choose"` (BZU MUN, since 2026-11-05) = page asks "Individually" (default; own fee; "we'll assign you to a
  delegation sent by Bayaan FAST") or "As a delegation" (head enters every delegate, one screenshot for delegates × fee).
  `false` / `true` lock one mode. Same DB either way (individual = a delegation of one). Admin MUN tab tallies 1st choices per committee. Config `BAYAAN.mun` (BZU MUN: PKR 1,000/delegate,
  no delegation fee, pay Imran Sarwar 0300 6395670 JazzCash; committees UNSC/UNGA/UNW/PNA/UNICEF as dropdowns).
  Live link: https://bayaan-iota.vercel.app/mun.html (applied by the user in the SQL editor 2026-11-05). DB `supabase/mun.sql`: `mun_delegations` + `mun_delegates`, written ONLY via
  the security-definer RPC `submit_mun_delegation()` (atomic; the real fee `v_fee` lives there — keep `BAYAAN.mun.fee` in step).
  One delegation per roll number per conference. Screenshots in `payment-proofs/mun/`. No email for MUN (decided 2026-11-04).
- **Admin board** `admin.html` + `js/admin.js`: tabs Induction / Events (verify payments, view screenshot via signed link) / MUN (delegations, expand for members, CSV = one line per delegate) / Broadcast.
- **Broadcasts** (`supabase/broadcasts.sql`): admin queues a message or certificates for an event; the Apps Script sends it. The page never sends mail.
- **Mailer**: `automation/confirmation-emails.gs` — Google Apps Script run from the society Gmail on a 5-minute timer (`tick`):
  1. emails "Registration successful" to `verified` rows not yet stamped `confirmation_sent_at`;
  2. processes queued `broadcasts` (announcements, or Slides-template PDF certificates) to all *verified* registrants of the event, once each (`broadcast_deliveries`).
  It is **not deployed by this repo** — the user pastes it into script.google.com (top level, not inside `myFunction`), sets Script Properties
  (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CERT_TEMPLATE_ID`) and runs `installTrigger` once. **They must re-paste it whenever the file changes.**

- **Posters are NOT in this repo.** Source HTML/PDF lives outside it in `C:/Users/Super/Documents/Bayaan-posters/` and the finished files are published as a claude.ai Artifact (see memory for the link). Workshop fee is PKR 200; site is https://bayaan-iota.vercel.app.

## Current state (2026-10-04)
- Workshop registration is live (covers Asian Style of Debating + Public Speaking); Dramatics is hidden.
- `BAYAAN.events.pay` filled 2026-10-04: PKR 200, title "M. Umais", account "+92 307 6537688", method "NayaPay" (live).
- Not built on purpose: a "verification in progress" email on submit (public form can name any address → abuse risk; needs a quota guard),
  emails to rejected payments, per-event scripts.
- Certificates go to **all verified** registrants after the event (no attendance tracking). Needs a Slides template with `{{name}}` → `CERT_TEMPLATE_ID`.
- n8n / Hostinger was dropped (cost). Don't reintroduce it.

## Testing without touching production
Use headless Edge + `puppeteer-core` against `node serve.js` with Supabase requests intercepted and mocked (add CORS headers to mocks);
test the `.gs` logic by running it in Node `vm` with fake `MailApp` / `UrlFetchApp` / `PropertiesService`.
