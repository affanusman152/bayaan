/* ══════════════ BAYAAN — event emails (confirmations, announcements, certificates) ══════════════
   Google Apps Script. Lives at script.google.com under the society's Gmail, NOT
   on the website — this file is kept in the repo only so it is versioned and
   documented. It contains no secrets; those go in Script Properties (see below).

   WHAT IT DOES — every 5 minutes, one job called `tick`:
     1. CONFIRMATIONS  Event registrations a council member marked `verified` that
        have not been emailed yet get a "Registration successful" email, and the
        row's `confirmation_sent_at` is stamped so nobody is emailed twice.
     2. BROADCASTS  Anything queued from the admin board's Broadcast tab: either a
        plain announcement ("come to Room B-12 at 2 PM") or CERTIFICATES (a PDF per
        person, made from a Google Slides template). Each goes to every VERIFIED
        registrant of the chosen event, once each; progress is written back so the
        admin board can show it.
   Polling (rather than a webhook) means a missed run costs nothing — the next
   run simply catches up.

   SETUP (about 10 minutes, free) — the full walkthrough is in README.md
     1. script.google.com → your project → paste this whole file over Code.gs
        (the whole script at the top level — not inside `function myFunction() {}`).
     2. Project Settings (gear) → Script Properties:
          SUPABASE_URL          https://rqmolxyuvuyuluzqmrbc.supabase.co   (the API address, NOT the dashboard link)
          SUPABASE_SERVICE_KEY  a secret key from Supabase → Project Settings → API Keys
          CERT_TEMPLATE_ID      (certificates only) the Google Slides file id — see below
        The service key is a master key. It stays in Script Properties, never in this
        file, the repo or a chat. If it ever leaks, rotate it in Supabase.
     3. Fill in the EVENTS block below (date, venue, notes), then save.
     4. Run `checkConnection`. Google asks you to authorise the script — Advanced →
        "Go to <project> (unsafe)" → Allow. You will be asked again whenever this file
        starts using a new Google service (Slides and Drive, for certificates).
     5. Run `testEmail` — sends a sample to YOU only.
     6. Run `installTrigger` ONCE. That is what makes it run by itself. Without it
        nothing is ever sent. (No "Deploy" is needed — that is only for web apps.)

   CERTIFICATE TEMPLATE
     Make a landscape Google Slides file: your certificate design as the slide
     background (export it from Canva as an image → Slide → Change background →
     Image), and a text box reading exactly {{name}} where the person's name goes.
     {{event}} is also replaced if you use it. Copy the id from the file's URL —
     docs.google.com/presentation/d/<THIS-PART>/edit — into CERT_TEMPLATE_ID.
     Run `testCertificate` to get one sent to yourself before sending to everyone.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── edit me ─────────────────────────────────────────────────────────────── */

const SOCIETY    = 'Bayaan — FAST NUCES Multan';
const SENDER     = 'Bayaan';                 // the "From" name students see
const REPLY_TO   = '';                       // optional, e.g. the society's Instagram email

/* Keys must match `key` in BAYAAN.events.list (js/data.js). Leave `when`, `where`
   or `notes` as '' and that line is simply left out of the email. `includes` is an
   optional list of sessions one registration covers; omit it for a single session. */
const EVENTS = {
  workshop: {
    name:  'Workshop',
    includes: ['Asian Style of Debating', 'Public Speaking'],   // one registration covers both
    when:  '',                               // e.g. 'Saturday 11 October, 2:00 PM'
    where: '',                               // e.g. 'Seminar Hall, FAST NUCES Multan'
    notes: ''                                // e.g. 'Please bring your student card.'
  },
  dramatics: {
    name:  'Dramatics',
    when:  '',
    where: '',
    notes: ''
  }
};

const CONFIRM_LIMIT = 40;                    // confirmations per run
const BUDGET_MS     = 4.5 * 60 * 1000;       // stop starting new work after this — Apps Script kills a run at 6 min

/* ── the timer's one job ─────────────────────────────────────────────────── */

let DEADLINE = 0;
const timeUp_ = function () { return Date.now() > DEADLINE; };

function tick() {
  /* two overlapping runs would double-send; the lock makes the second one wait its turn */
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) { console.log('another run is in progress — skipping'); return; }
  DEADLINE = Date.now() + BUDGET_MS;
  try {
    confirmVerified_();
    runBroadcasts_();
  } finally {
    lock.releaseLock();
  }
}

/* ══ 1. confirmations ═══════════════════════════════════════════════════════ */

function confirmVerified_() {
  const rows = sb_('get',
    'event_registrations?status=eq.verified&confirmation_sent_at=is.null' +
    '&select=id,event,full_name,roll_no,email&order=verified_at.asc&limit=' + CONFIRM_LIMIT);

  let sent = 0;
  for (const r of rows) {
    if (timeUp_()) break;
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.warn('Gmail daily quota used up — the rest go out tomorrow.');
      break;
    }
    try {
      const mail = buildConfirmation_(r);
      MailApp.sendEmail({
        to: r.email, subject: mail.subject, body: mail.text, htmlBody: mail.html,
        name: SENDER, replyTo: REPLY_TO || undefined
      });
    } catch (err) {
      console.error('email failed for ' + r.id + ': ' + err);   // left unstamped → retried next run
      continue;
    }
    /* The `is.null` filter makes the stamp a no-op if something already stamped
       this row, so a retry can never overwrite a real timestamp. */
    try {
      sb_('patch', 'event_registrations?id=eq.' + r.id + '&confirmation_sent_at=is.null',
          { confirmation_sent_at: new Date().toISOString() });
      sent++;
    } catch (err) {
      console.error('EMAILED BUT COULD NOT STAMP ' + r.id + ' (' + r.email + '): ' + err +
                    ' — this person may get a second email next run.');
    }
  }
  console.log('confirmations sent: ' + sent + ' of ' + rows.length + ' waiting');
}

function buildConfirmation_(r) {
  const ev   = eventOf_(r.event);
  const name = displayName_(r.full_name);

  const details = detailRows_(ev);
  const text =
    'Assalam-o-Alaikum ' + name + ',\n\n' +
    'Registration successful! Your payment has been verified and your registration for ' +
      ev.name + ' is confirmed.\n\n' +
    details.map(function (d) { return d[0] + ': ' + d[1]; }).join('\n') + '\n' +
    (ev.notes ? '\n' + ev.notes + '\n' : '') +
    '\nRoll number on this registration: ' + r.roll_no + '\n' +
    'Keep this email — you may be asked to show it at the door.\n\n' +
    'See you there,\n' + SOCIETY + '\n';

  const html = card_('REGISTRATION SUCCESSFUL', 'You\'re in, ' + esc_(name) + '.',
    '<p style="margin:0 0 16px">Your payment has been verified and your registration for ' +
      '<b style="color:#F6D68A">' + esc_(ev.name) + '</b> is confirmed.</p>' +
    tableHtml_(details) +
    (ev.notes ? '<p style="margin:0 0 16px">' + esc_(ev.notes) + '</p>' : '') +
    '<p style="margin:0 0 16px;font-size:13px;color:#8E7F74">Roll number on this registration: ' +
      esc_(r.roll_no) + '. Keep this email — you may be asked to show it at the door.</p>');

  return { subject: 'Registration successful — ' + ev.name + ' | Bayaan', text: text, html: html };
}

/* ══ 2. broadcasts: announcements + certificates ════════════════════════════ */

function runBroadcasts_() {
  const queue = sb_('get', 'broadcasts?status=in.(queued,sending)&select=*&order=created_at.asc&limit=5');
  for (const b of queue) {
    if (timeUp_()) break;
    try {
      runOne_(b);
    } catch (err) {
      console.error('broadcast ' + b.id + ' failed: ' + err);
      markFailed_(b, err);
    }
  }
}

function runOne_(b) {
  const ev = eventOf_(b.event);
  const isCert = b.kind === 'certificate';

  if (isCert && !PropertiesService.getScriptProperties().getProperty('CERT_TEMPLATE_ID')) {
    markFailed_(b, 'Set CERT_TEMPLATE_ID in the script\'s Script Properties (the Slides template id), then queue it again.');
    return;
  }

  /* a TEST goes to one address and touches nobody else */
  if (b.test_to) {
    patchBroadcast_(b.id, { status: 'sending' });
    deliver_(b, ev, { full_name: 'Test Student', roll_no: '25M-0000', email: b.test_to }, true);
    patchBroadcast_(b.id, { status: 'done', total: 1, sent_count: 1, done_at: new Date().toISOString() });
    return;
  }

  const regs = sb_('get',
    'event_registrations?status=eq.verified&event=eq.' + encodeURIComponent(b.event) +
    '&select=id,full_name,roll_no,email&order=verified_at.asc&limit=1000');
  const have = sb_('get',
    'broadcast_deliveries?broadcast_id=eq.' + b.id + '&select=registration_id,ok&limit=5000');

  const handled = {};
  let sent = 0, failed = 0;
  have.forEach(function (d) { handled[d.registration_id] = true; if (d.ok) sent++; else failed++; });
  const todo = regs.filter(function (r) { return !handled[r.id]; });

  const total = Math.max(b.total || 0, have.length + todo.length);
  if (b.status === 'queued') patchBroadcast_(b.id, { status: 'sending', total: total });

  let left = todo.length;
  for (const r of todo) {
    if (timeUp_()) break;
    if (MailApp.getRemainingDailyQuota() < 1) { console.warn('Gmail daily quota used up — resuming tomorrow.'); break; }
    let ok = true, why = null;
    try {
      deliver_(b, ev, r, false);
    } catch (err) {
      ok = false; why = String(err).slice(0, 300);
      console.error('could not mail ' + r.email + ': ' + why);
    }
    try {
      sb_('post', 'broadcast_deliveries', { broadcast_id: b.id, registration_id: r.id, ok: ok, error: why });
    } catch (err) {
      console.error('MAILED BUT COULD NOT RECORD ' + r.id + ' (' + r.email + '): ' + err +
                    ' — this person may get a second copy next run.');
    }
    if (ok) sent++; else failed++;
    left--;
  }

  const finished = left === 0;
  patchBroadcast_(b.id, {
    status: finished ? 'done' : 'sending',
    total: total, sent_count: sent, failed_count: failed,
    done_at: finished ? new Date().toISOString() : null
  });
  console.log('broadcast ' + b.id + ' (' + b.kind + '): ' + sent + ' sent, ' + failed + ' failed, ' + left + ' to go');
}

/* sends ONE email for a broadcast to one person */
function deliver_(b, ev, r, isTest) {
  const name = displayName_(r.full_name);
  const mail = buildAnnouncement_(b, name);
  const opts = {
    to: r.email,
    subject: (isTest ? '[TEST] ' : '') + b.subject,
    body: mail.text, htmlBody: mail.html, name: SENDER, replyTo: REPLY_TO || undefined
  };
  if (b.kind === 'certificate') opts.attachments = [makeCertificate_(name, ev)];
  MailApp.sendEmail(opts);
}

function buildAnnouncement_(b, name) {
  const body = String(b.body || '').trim();
  const text = 'Assalam-o-Alaikum ' + name + ',\n\n' + (body ? body + '\n\n' : '') + SOCIETY + '\n';
  const paras = body.split(/\n{2,}/).map(function (p) {
    return '<p style="margin:0 0 16px">' + esc_(p).replace(/\n/g, '<br />') + '</p>';
  }).join('');
  const html = card_(b.kind === 'certificate' ? 'YOUR CERTIFICATE' : 'FROM BAYAAN', esc_(b.subject),
    '<p style="margin:0 0 16px">Assalam-o-Alaikum ' + esc_(name) + ',</p>' + paras);
  return { text: text, html: html };
}

/* fills the Slides template for one person and returns it as a PDF */
function makeCertificate_(name, ev) {
  const id = PropertiesService.getScriptProperties().getProperty('CERT_TEMPLATE_ID');
  const copy = DriveApp.getFileById(id).makeCopy('cert-tmp-' + Date.now());
  try {
    const pres = SlidesApp.openById(copy.getId());
    pres.replaceAllText('{{name}}', name);
    pres.replaceAllText('{{event}}', ev.name);
    pres.saveAndClose();
    return copy.getAs('application/pdf').setName('Certificate - ' + name + '.pdf');
  } finally {
    copy.setTrashed(true);                   // never leave a pile of temp copies in Drive
  }
}

function patchBroadcast_(id, fields) { sb_('patch', 'broadcasts?id=eq.' + id, fields); }

function markFailed_(b, err) {
  try {
    patchBroadcast_(b.id, { status: 'failed', error: String(err).slice(0, 300), done_at: new Date().toISOString() });
  } catch (e) {
    console.error('could not even record the failure for ' + b.id + ': ' + e);
  }
}

/* ══ shared: email layout ═══════════════════════════════════════════════════ */

function eventOf_(key) {
  return EVENTS[key] || { name: key, when: '', where: '', notes: '' };
}

function detailRows_(ev) {
  return [
    ['Event', ev.name],
    ['Sessions', (ev.includes || []).join(' + ')],
    ['When', ev.when],
    ['Where', ev.where]
  ].filter(function (d) { return d[1]; });
}

function tableHtml_(details) {
  const rows = details.map(function (d) {
    return '<tr><td style="padding:4px 14px 4px 0;color:#8E7F74">' + esc_(d[0]) +
           '</td><td style="padding:4px 0;color:#F6EFE3"><b>' + esc_(d[1]) + '</b></td></tr>';
  }).join('');
  return '<table style="border-collapse:collapse;margin:0 0 16px;font-size:15px">' + rows + '</table>';
}

/* the maroon-and-gold card every email sits in; `heading` and `inner` must already be escaped */
function card_(eyebrow, heading, inner) {
  return '<div style="background:#0A0607;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#140B0C;border:1px solid #4E0509;' +
    'border-radius:14px;padding:28px 26px;color:#CDBFAE;line-height:1.6">' +
      '<p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:#E3A72F">' + eyebrow + '</p>' +
      '<h1 style="margin:0 0 16px;font-size:26px;color:#F6EFE3">' + heading + '</h1>' +
      inner +
      '<p style="margin:0;color:#E3A72F">' + esc_(SOCIETY) + '</p>' +
    '</div></div>';
}

/* "ali raza" and "ALI RAZA" both become "Ali Raza"; a name someone typed with their
   own capitals ("Ali Raza", "McKenzie") is left exactly as they wrote it. */
function displayName_(s) {
  const n = String(s || '').trim().replace(/\s+/g, ' ');
  if (n !== n.toLowerCase() && n !== n.toUpperCase()) return n;
  return n.toLowerCase().replace(/(^|[\s'\-])([a-zÀ-ɏ])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

/* names come from a public form — never put them into HTML unescaped */
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ══ Supabase (plain REST, same as the website) ═════════════════════════════ */

function sb_(method, path, body) {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Project Settings → Script Properties.');

  const opts = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  };
  if (method === 'patch') { opts.headers.Prefer = 'return=minimal'; opts.payload = JSON.stringify(body); }
  /* ignore-duplicates: recording the same delivery twice is harmless, not an error */
  if (method === 'post')  { opts.headers.Prefer = 'return=minimal,resolution=ignore-duplicates'; opts.payload = JSON.stringify(body); }

  const res = UrlFetchApp.fetch(url + '/rest/v1/' + path, opts);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Supabase ' + code + ': ' + res.getContentText().slice(0, 300));
  return method === 'get' ? JSON.parse(res.getContentText()) : null;
}

/* ══ one-time helpers: run these by hand from the editor ═══════════════════ */

/* Is everything wired up? Reads, never writes, never emails. */
function checkConnection() {
  const waiting = sb_('get', 'event_registrations?status=eq.verified&confirmation_sent_at=is.null&select=id');
  console.log('Connected to Supabase. ' + waiting.length + ' verified registration(s) are waiting for a confirmation email.');
  const queued = sb_('get', 'broadcasts?status=in.(queued,sending)&select=id');
  console.log(queued.length + ' broadcast(s) queued or in progress.');
  console.log('Gmail quota left today: ' + MailApp.getRemainingDailyQuota() + ' emails.');
  console.log('Certificate template: ' + (PropertiesService.getScriptProperties().getProperty('CERT_TEMPLATE_ID')
    ? 'CERT_TEMPLATE_ID is set.' : 'CERT_TEMPLATE_ID is NOT set (only needed for certificates).'));
  const timers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'tick'; });
  console.log(timers.length ? 'Timer: installed — runs automatically.' : 'Timer: NOT installed — run installTrigger, or nothing is ever sent.');
}

/* Sends a sample of each event's confirmation to YOU only. Touches no registration. */
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  Object.keys(EVENTS).forEach(function (key) {
    const mail = buildConfirmation_({ event: key, full_name: 'test student', roll_no: '25M-0000', email: me });
    MailApp.sendEmail({ to: me, subject: '[TEST] ' + mail.subject, body: mail.text,
                        htmlBody: mail.html, name: SENDER });
  });
  console.log('Sample emails sent to ' + me + '.');
}

/* Sends ONE sample certificate to YOU — use it to check your Slides template. */
function testCertificate() {
  const me = Session.getEffectiveUser().getEmail();
  const key = Object.keys(EVENTS)[0];
  const ev = eventOf_(key);
  if (!PropertiesService.getScriptProperties().getProperty('CERT_TEMPLATE_ID')) throw new Error('Set CERT_TEMPLATE_ID first.');
  deliver_({ kind: 'certificate', subject: 'Your certificate — ' + ev.name,
             body: 'Thank you for being part of the ' + ev.name + '. Your certificate is attached.' },
           ev, { full_name: 'Test Student', email: me }, true);
  console.log('Sample certificate sent to ' + me + '.');
}

/* Run ONCE. Safe to run again — it replaces the old timer instead of stacking another. */
function installTrigger() {
  removeTrigger_();
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  console.log('Timer installed: tick runs every 5 minutes.');
}

/* Switch the automation off (e.g. after the events are over). */
function removeTrigger() {
  removeTrigger_();
  console.log('Timer removed. No more automatic emails.');
}

function removeTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const h = t.getHandlerFunction();
    if (h === 'tick' || h === 'sendConfirmations') ScriptApp.deleteTrigger(t);   // 'sendConfirmations' = the older name
  });
}
