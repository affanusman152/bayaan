# Bayaan — motion scaffold

Literary & public speaking society · FAST NUCES Multan Campus.
Mobile-first, zero dependencies, zero build step.

```
node serve.js     →  http://localhost:5173     (recommended)
```
Opening `index.html` directly works too — see the note under **The logo** for the one
difference.

---

## ⚠️ First thing: drop the logo in

Save the بیان artwork as **`assets/logo.png`**. Everything else is already wired to it —
splash, header, curtain seal, drawer watermark, hero wordmark, join seal, team card
placeholders and the favicon. Until the file exists, the site runs on a hand-vectored
stand-in and logs a note to the console.

### The logo, handled properly
The artwork you have sits on a **solid black background**, which looks fine on the dark
screens and like a black box over the maroon glow. So `js/logo.js` **keys the black out at
load**: the art is already effectively screened against black, so alpha is `max(r,g,b)` and
an un-premultiply restores true colour — a clean cutout with the antialiasing intact. No
manual editing needed.

That keying reads pixels off a canvas, which browsers block on `file://` origins. So:

| How you open it | What happens |
|---|---|
| `node serve.js` (or any http server) | Black is keyed out — clean transparent mark everywhere ✅ |
| double-clicking `index.html` | Falls back to `mix-blend-mode: screen` — good on dark areas, can show a faint box over the maroon glow |
| you supply a **transparent PNG** | Best of all; nothing to key, works either way |

If you have a transparent-background export, use that and ignore all of the above.

---

## The motion idea

Bayaan's identity is a *stroke* — the qalam sweep under بیان, the mic, the brush.
So nothing on this site fades in generically. Everything **draws, bleeds, wipes or settles**,
the way ink behaves. Three rules the whole scaffold obeys:

1. **Urdu always reveals right-to-left.** It's written, not animated onto the screen.
2. **Gold is light, maroon is mass.** Gold shimmers and travels; maroon slides and blocks.
3. **One easing does the personality.** `--e-ink` (a long settle) is on ~80% of moves.

---

## Animation catalogue — what's actually in here

| # | Where | What happens |
|---|-------|--------------|
| 01 | **Intro** | The **same curtain as the page transitions**, deliberately. Four maroon panels wipe up in a stagger, the بیان seal holds at centre, then they wipe away. Not a separate animation: `js/intro.js` drives the router's own `#curtain` element and its `is-in` / `is-out` classes, so the way the site opens and the way it moves are one gesture and cannot drift apart. |
| 02 | **Intro → site** | The header mark springs in as the panels clear; the stage fades up behind them. |
| 03 | **Hero** | **Two layouts, split at 1024px.** Desktop is the full-bleed overlay: the photo bleeds behind the whole type block, greyscaled then **duotoned** to maroon shadows / gold highlights via blend layers, with a maroon ink curtain lifting off it on load and a slow 14s ken-burns push-in. Below 1024px it becomes two zones instead — headline up top, photo as a **stage band** across the foot, the society standing under the title. Headline splits into masked lines that slide up. Falls back to a designed maroon panel when no photo is present. |
| 04 | **Hero couplet** | Per-word bloom — each word rises out of a blur, sequenced **right to left** so it reads as it appears. |
| 05 | **Screen transitions** | The same four-panel curtain as the intro. Outgoing screen scales + blurs out; incoming rises out of the wipe. |
| 06 | **Drawer** | Headed **Contents / فہرست**. Slides on `--e-glide`, items stagger in from the right, each row reveals its Urdu name and a gold underline on hover. Burger morphs to an X. Urdu watermark drifts behind it. Swipe-right closes; edge-swipe from the right rim opens. Foot carries two chips — an outlined **Instagram** with its glyph, and **Register** in the same gold as the hero CTA. |
| 07 | **Page titles** | Split into masked lines that slide up with a slight rotation. |
| 08 | **Wings** | An **index, not a rail**. A full-bleed band of the induction night opens the screen and names the umbrella, then the six wings are listed under the two halves the society is actually named after — *Public Speaking* and *Literary*. Each row sweeps a maroon wash in from the left on hover, grows the gold spine borrowed from the pillars, and its line-icon **draws itself** (`stroke-dashoffset`) when it scrolls in. |
| 09 | **Ventures** | Vertical timeline whose gold spine **fills as you scroll**; each node lights up and rings when its entry enters view. **Harf se Harf Tak** — the society's main event — is lifted out of the plain list into a bordered flagship card with a gold badge and its Urdu title. |
| 10 | **Team** | Poster-style cards where a maroon curtain **lifts off each portrait**, staggered — the same feel as your council posters. |
| 11 | **Stats** | Count up from zero on first view. |
| 12 | **Ambience** | Film grain, vignette, a maroon aura that tracks the pointer (drifts on scroll for touch), a gold scroll-progress nib on the right edge, hiding-on-scroll top bar, magnetic buttons on pointer devices, and a paused-on-hover couplet ticker. There is **no scroll-down hint** at the foot of the hero — it was removed. |
| 13 | **Join** | Breathing wax seal, staggered steps, gold CTA with a cream fill that rises from the bottom. |
| 14 | **Group frame** (About) | The same group photograph as the hero, but shown **uncropped and untinted** — the hero band crops to the faces, this is the whole picture in true colour. Gold poster corner-ticks frame it, and the hero's own `inkLift` curtain wipes off it when it scrolls in. |

Everything degrades correctly under `prefers-reduced-motion: reduce` — reveals fire instantly
and the curtain is skipped entirely, intro included.

**A known trade, chosen on purpose.** On desktop the type sits over the photograph, so on
viewports narrower than roughly 1800px the headline crosses the back row's faces. That is
accepted for the full-bleed drama on a large screen. It is *not* accepted on phones — a 3:2
group shot under `object-fit: cover` in a portrait viewport keeps only about the middle
third, which is why the stage-band layout takes over below 1024px. If you ever want the
band on desktop too, delete the `.hero` overrides in the `min-width: 1024px` block of
`css/screens.css`; the band is the default and needs nothing else.

**A rule the scaffold follows:** no decorative animation is allowed to be the thing that makes
content visible. Every reveal has an *open* resting state and animates from an explicit `from`
keyframe, so a reveal that fails to fire costs the animation and never the content.

---

## Where to put your content

Everything renders from **`js/data.js`**. Nothing else needs touching for content.

| Want to change | Edit |
|---|---|
| Registration form | it posts to Supabase — see **Registrations** below |
| **Event popup** (workshop / dramatics) — events, fee, account number, on/off | `BAYAAN.events` — see **Event registration** below. `pay.account` is blank until you add it |
| Ticker couplets | `BAYAAN.ticker` |
| Wings (name / Urdu / blurb / tags / icon) | `BAYAAN.wings` — each wing's `family` (`"speaking"` or `"literary"`) decides which half it lists under. A wing with no `family` still renders; it falls into the last group rather than vanishing |
| Ventures — **add freely, the list is meant to grow** | `BAYAAN.ventures` — set `flagship: true` on one to pull it out as the main-event card, and `ur` for its Urdu title |
| Induction photo (the wings band) | `assets/induction.jpg`, referenced directly in `index.html` |
| Council members + section bands | `BAYAAN.team` |
| **Council photos** | drop files in `assets/team/` using the exact names in [`assets/team/README.txt`](assets/team/README.txt). Missing or broken files fall back to the بیان placeholder card, so you can add them one at a time |
| Logo path | `BAYAAN.config.logo` |
| Hero photo | `BAYAAN.config.heroPhoto` — the file lives at `assets/hero.jpg` ✅ *installed* |
| The About group frame | it points at `assets/hero.jpg` directly, in `index.html` — replace the file and both it and the hero follow |
| Intro hold | `BAYAAN.config.introMs` |
| Society prose, pillars, join steps | directly in `index.html` |

> ⚠️ Council names in `data.js` were transcribed off the poster image — **verify the spellings** before this goes live.

### Colours
All in `css/tokens.css`. Change `--maroon`, `--gold`, `--cream` and the entire site follows —
the gradients, glows and shadows are all derived from those three.

### Re-exporting the logo
Any size or crop is fine. The mark is only ever *placed*, never traced, so nothing depends on
its internal geometry.

---

## Structure

```
index.html          all six screens, in order
admin.html          the registrations board — Induction, Events and Broadcast tabs (noindex, not linked from the site)
serve.js            `node serve.js` — tiny static server, no deps
supabase/schema.sql the induction tables and row-level-security rules — run this once
supabase/events.sql the event-registration table + private screenshot bucket — run after schema.sql
supabase/broadcasts.sql the broadcast queue + per-person delivery log — run after events.sql
css/tokens.css      colour · type · spacing · easing curves
css/base.css        reset + grain/vignette/aura ambience
css/logo.css        every placement of the mark, in one file
css/ui.css          top bar · drawer · curtain · buttons · ticker
css/screens.css     hero · about · wings · ventures · team · join · form
css/motion.css      reveal utilities + screen enter/exit
automation/confirmation-emails.gs  Google Apps Script (runs on Google, not on the site) — confirmations, announcements, certificates
css/events.css      the event popup and its "Register" pill
css/admin.css       the board — dense and plain, palette only
js/data.js          ← content lives here, plus the two Supabase values
js/logo.js          loads the mark, keys out the black, fits it to the mask
js/motion.js        reveal engine, counters, parallax, magnetics
js/render.js        data → DOM
js/supabase.js      ~80 lines of fetch (REST + storage) — no SDK, no build step
js/join.js          the induction registration form
js/events.js        the event popup: auto-open, validation, screenshot upload, submit
js/admin.js         sign-in, both tables (Induction / Events), triage, screenshot viewer, CSV export, the Broadcast tab
js/drawer.js        drawer + focus trap + swipe gestures
js/router.js        hash routing + the curtain transition
js/intro.js         the intro — reuses the router's curtain
js/app.js           boot order
```

Routes: `#/home` `#/about` `#/wings` `#/ventures` `#/team` `#/join` — deep-linkable,
back button works, and ← / → arrow keys walk between screens.

## Registrations

The join screen is a real form that writes to Supabase, and `admin.html` is the board
the council reads it on. No SDK and no build step — Supabase is plain REST, so
`js/supabase.js` is about sixty lines of `fetch`.

**Until you do the three steps below, nothing is broken:** the join screen shows a
"registrations aren't open through the site yet" panel instead of a form, and the admin
page says it is not connected. That is the unconfigured state, not a bug.

### 1 — Run the schema
Paste all of `supabase/schema.sql` into the Supabase SQL editor and run it. It creates
`registrations`, an `admins` table, and the row-level-security policies. Safe to re-run.

### 2 — Paste two values into `js/data.js`
From **Project Settings → Data API**:

```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseKey: "…the publishable / anon key…",
```

The publishable key is **meant** to be public — it names the project, it does not
authorise anything. Row-level security is the actual lock. Never paste a
**service-role** key here; that one really is a master key, and this repo is public.

### 3 — Make yourself an admin
Authentication → Users → add your account, then run:

```sql
insert into public.admins (user_id, email) values ('THE-USER-UID', 'you@example.com');
```

**Also turn off "Allow new users to sign up"** (Authentication → Sign In / Providers).
Being signed in is deliberately not enough to read submissions — an account also has to
be listed in `admins` — but leaving public sign-up on is still a door worth shutting.

### What the rules actually enforce

| Who | Can |
|---|---|
| Anyone (the public form) | insert a registration, and nothing else |
| A signed-in account **not** in `admins` | nothing — reads come back as an empty list |
| A signed-in account **in** `admins` | read every submission, set `status` and `notes` |
| Anyone at all | **cannot delete** — there is no delete policy and no delete grant |

The public form physically cannot write `status` or `notes`: those columns are left out
of the column-level `grant insert`, so an applicant cannot mark themselves accepted.
One registration per roll number is enforced by a unique index, and the form turns the
resulting 409 into a readable sentence rather than a stack trace.

### The admin board — `/admin.html`
Sign in, then search, filter by status, expand a row for the long answers, change
someone's status inline, or export the current view to CSV. It is `noindex` and is not
linked from the site — though that is tidiness, not security. The database is what
refuses strangers.

CSV cells that begin with `=`, `+`, `-` or `@` are prefixed with an apostrophe on export,
because Excel and Sheets execute those as formulas — a real attack route through any
public form.

## Event registration (workshop + dramatics)

A popup that opens on its own when the site loads — after the intro curtain clears,
once per visit — and stays reachable from a gold **Register** pill at the foot of the
screen. The visitor picks an event, reads where to send the money, and submits **name,
roll number, email and a screenshot of the payment**. One event per submission; someone
doing both submits twice (the popup offers "Register another").

It is **not shown to anyone who has already registered** from that browser, and nobody
sees it twice in the same visit. Both are remembered in browser storage.

### Switching it on
1. Supabase is already configured (see **Registrations**), and `schema.sql` has been run.
2. Run **`supabase/events.sql`** (paste it into the SQL editor). It creates
   `event_registrations` and a **private** `payment-proofs` storage bucket. Safe to re-run.
   ✅ *Already applied to the live project on 2026-10-01 as the migration
   `event_registrations_and_payment_proofs`, and the permissions were tested against it.*
3. Fill in `BAYAAN.events.pay` in `js/data.js` — `account` (and, if you like, `method`,
   `title`, `fee`). Anything left blank is simply not shown; with `account` blank the popup
   says payment details will appear shortly.
4. Set `BAYAAN.events.open` to `true` to switch the popup and pill on, `false` to switch
   them off. **It is currently `true`, for the Workshop only.**

**Which events show.** `BAYAAN.events.list` holds every event; an entry with
`hidden: true` stays defined (the admin board still resolves its name on old rows) but is
kept out of the popup and the pill. **Dramatics is currently hidden** — delete its
`hidden: true` to open it; with two visible events the popup shows a picker, with one it
skips the picker and pre-selects it. `includes: [...]` lists what one registration covers
and is shown in a highlighted box in the popup.

**The Workshop** is one event (`key: "workshop"`, one fee, one registration) that covers
two sessions: *Asian Style of Debating* and *Public Speaking*. Both are listed in the
popup and in the confirmation email.

⚠️ While `pay.account` is blank the popup says payment details will appear shortly, so
nobody can pay yet — fill `pay.account` (and `method`, `title`, `fee`) in as soon as you
have them.

**Still not built:** a "thank you — verification in progress" email sent the moment someone
submits. (Held back on purpose: the public form can name any address, so an automatic
acknowledgement could be abused to make the society's Gmail mail strangers — it needs a
quota guard first.)

### What the rules enforce
| Who | Can |
|---|---|
| Anyone (the popup) | upload one image to the bucket, and insert a row with status `pending` — nothing else |
| Anyone | **cannot read, list, overwrite or delete** any screenshot or row |
| An admin | read every row and screenshot (through a 5-minute signed link), set `status` and `notes` |

The bucket itself rejects anything over **5 MB** or that is not JPG / PNG / WebP, so those
limits hold even if someone bypasses `js/events.js`. One registration per roll number
**per event** is a unique index. A failed submit after a good upload can leave one stray,
unreadable image behind — harmless.

### Verifying payments — the Events tab on `/admin.html`
Open the **Events** tab, click **View screenshot**, compare it with the account statement,
then set the row's status to `verified` (or `rejected`). Moving to `verified` stamps
`verified_at` automatically. `confirmation_sent_at` is reserved for the email automation.

### Emails — a free Google Apps Script
`automation/confirmation-emails.gs` is **not part of the website**. It runs on Google's
servers under the society's Gmail; the copy in the repo is for versioning and reference
(**every time it changes, paste the new version into Apps Script again** and re-fill the
`EVENTS` block). One job, `tick`, runs every 5 minutes and does two things:

1. **Confirmations.** Rows marked `verified` with no `confirmation_sent_at` get a
   "Registration successful" email (it lists the sessions, date and venue from `EVENTS`),
   then the row is stamped so nobody is emailed twice.
2. **Broadcasts.** Anything queued from the admin board's **Broadcast** tab (below).

Polling means a missed run just catches up. There is no n8n and no server.

**Setup (≈10 min, free, done once):**
1. Sign in to the society Gmail → <https://script.google.com> → your project → paste the
   whole of `automation/confirmation-emails.gs` over `Code.gs`, **at the top level** — not
   inside the `function myFunction() { … }` a new project starts with.
2. Edit the `EVENTS` block at the top (date, venue, notes — blank lines are left out).
3. ⚙ **Project Settings → Script Properties** → add `SUPABASE_URL` — the **API** address
   `https://rqmolxyuvuyuluzqmrbc.supabase.co`, *not* the dashboard link — and
   `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API Keys → a **secret** key).
   ⚠️ That key is a master key: it lives only here, never in the repo, the site, a chat or a
   screenshot. Rotate it in Supabase if it ever leaks.
4. Pick `checkConnection` → **Run**. Approve the permissions (Advanced → "Go to … (unsafe)"
   is normal for your own script; you are asked again whenever the script starts using a
   new Google service). It reports the Gmail quota, how many verified rows are waiting, and
   whether the timer is installed.
5. Run `testEmail` — sends a sample confirmation of each event to *you only*.
6. Run `installTrigger` **once**. That is what makes it run by itself — without it nothing
   is ever sent. **No "Deploy" is needed** (that is only for web apps). `removeTrigger`
   switches it off. If a verified registration is not emailed, `checkConnection` saying
   "Timer: NOT installed" is the first thing to look for; the ⏰ Triggers page and the
   ▶ Executions page in Apps Script show every run and any error.

**Limits:** Apps Script caps how many emails a Google account can send per day, and
`checkConnection` prints what is left (the society account showed **1500** on 2026-10-01;
plain consumer accounts have historically been nearer 100, so trust that printout, not
this number). The script checks the quota before every email and stops cleanly, resuming
the next day. If you ever outgrow it, Brevo's free tier (300/day, no domain needed) is the
next step. **Not covered:** rejected payments get no email — contact those students by hand.

### Broadcasts — announcements and certificates (Broadcast tab, `/admin.html`)
Run `supabase/broadcasts.sql` once (✅ applied to the live project on 2026-10-01 as the
migration `broadcasts_and_deliveries`; it needs `schema.sql` and `events.sql` first).

The admin page **never sends mail itself** — it queues a row in `broadcasts`, and the
script mails it within about 5 minutes and writes progress back (`sent / total`, failures,
status `queued → sending → done`), which the page shows in a table that refreshes while you
watch. A broadcast goes only to registrations marked **verified** for the event you pick,
once each (`broadcast_deliveries` is what stops a second copy). A run that is cut short, or
hits the daily quota, simply resumes on the next tick.

* **Message** — e.g. "Room B-12 at 2 PM". Each email opens "Assalam-o-Alaikum <name>,".
* **Certificates** — each person gets a PDF with their own name, made from a Google Slides
  template. Per the rule decided 2026-10-01 it goes to **every verified registrant** after the
  event; there is no attendance tracking.
* **Send a test to me** queues one sample to *your own* sign-in email and nobody else —
  always do this first. Real sends ask you to confirm the recipient count, and a second
  certificate send for the same event warns that everyone would get a *second* one.
* Only admins can queue one (row-level security). Nobody can edit or delete a broadcast.

**One-time certificate template setup:**
1. In Google Slides make a landscape deck with your certificate design as the slide
   background (export the design from Canva as an image → Slide → *Change background* →
   *Image*), and a text box that reads exactly `{{name}}` where the name goes
   (`{{event}}` is replaced too, if you use it).
2. Copy the id from its URL — `docs.google.com/presentation/d/<THIS-PART>/edit` — into a
   new Script Property `CERT_TEMPLATE_ID`.
3. Re-run `checkConnection` (it will ask to authorise Drive and Slides), then run
   `testCertificate` — a sample certificate arrives in your inbox. Fix the template until it
   looks right, *then* use the Broadcast tab.
Names typed all-lowercase or all-capitals (`ali raza`, `ALI RAZA`) are tidied to `Ali Raza`
on certificates and in greetings; names typed with their own capitals are left alone.
If `CERT_TEMPLATE_ID` is missing, a certificate broadcast is marked **failed** with that
message and nothing is sent. A single bad address is recorded as failed and skipped, never
retried, so it cannot stall everyone else. Send-lists are capped at 1000 verified
registrants per event per run.

### Known limits, stated plainly
* **Spam.** There is a honeypot field and the one-per-roll-number rule, but no true rate
  limiting — that needs an edge function. Fine for a campus induction; not fine for a
  form left open to the whole internet for months. The event popup is the same, with one
  addition: a bot could fill the screenshot bucket with 5 MB images, which is another
  reason to switch `events.open` off when registrations close.
* **Client-side validation is courtesy, not security.** Anyone can POST straight past
  `js/join.js`. Every rule is also a database constraint, and that is the one that counts.
* **Applicants' phone numbers and emails are personal data.** Only add people to `admins`
  who should see them, and prefer CSV exports over screenshots in group chats.

## Deploying
It's a static site. Drag the folder onto Netlify, or push to GitHub and turn on Pages.
