/* ══════════════ BAYAAN — payment-verified confirmation emails ══════════════
   Google Apps Script. Lives at script.google.com under the society's Gmail, NOT
   on the website — this file is kept in the repo only so it is versioned and
   documented. It contains no secrets; those go in Script Properties (see below).

   WHAT IT DOES
   Every 5 minutes it asks Supabase for event registrations that a council member
   has marked `verified` but that have not been emailed yet, sends each student a
   confirmation from this Gmail account, then stamps `confirmation_sent_at` so
   nobody is emailed twice. Polling (rather than a webhook) means a missed run
   costs nothing: the next run simply catches up.

   SETUP (about 10 minutes, free) — the full walkthrough is in README.md
     1. script.google.com → New project → paste this whole file in.
     2. Project Settings (gear) → Script Properties → add two:
          SUPABASE_URL          https://rqmolxyuvuyuluzqmrbc.supabase.co
          SUPABASE_SERVICE_KEY  the service_role key (Supabase → Project Settings → API)
        The service key is a master key. It stays in Script Properties, never in this
        file, the repo or a chat. If it ever leaks, rotate it in Supabase.
     3. Fill in the EVENTS block below (date, venue, notes), then save.
     4. Run `checkConnection` once. Google asks you to authorise the script — choose
        Advanced → "Go to <project> (unsafe)" → Allow. That warning is normal for any
        script you wrote yourself.
     5. Run `testEmail` — it sends a sample to YOU only. Check how it looks.
     6. Run `installTrigger` once. Done: it now runs every 5 minutes.
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

const BATCH_LIMIT = 40;                      // emails per run — stays well inside Gmail's daily quota

/* ── the job ─────────────────────────────────────────────────────────────── */

function sendConfirmations() {
  /* two overlapping runs would double-send; the lock makes the second one wait its turn */
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) { console.log('another run is in progress — skipping'); return; }

  try {
    const rows = sb_('get',
      'event_registrations?status=eq.verified&confirmation_sent_at=is.null' +
      '&select=id,event,full_name,roll_no,email&order=verified_at.asc&limit=' + BATCH_LIMIT);

    let sent = 0;
    for (const r of rows) {
      if (MailApp.getRemainingDailyQuota() < 1) {
        console.warn('Gmail daily quota used up — the rest go out tomorrow.');
        break;
      }
      try {
        const mail = buildEmail_(r);
        MailApp.sendEmail({
          to: r.email,
          subject: mail.subject,
          body: mail.text,
          htmlBody: mail.html,
          name: SENDER,
          replyTo: REPLY_TO || undefined
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
  } finally {
    lock.releaseLock();
  }
}

/* ── the email ───────────────────────────────────────────────────────────── */

function buildEmail_(r) {
  const ev   = EVENTS[r.event] || { name: r.event, when: '', where: '', notes: '' };
  const name = String(r.full_name || '').trim();

  const details = [
    ['Event', ev.name],
    ['Sessions', (ev.includes || []).join(' + ')],
    ['When', ev.when],
    ['Where', ev.where]
  ].filter(function (d) { return d[1]; });

  const text =
    'Assalam-o-Alaikum ' + name + ',\n\n' +
    'Your payment has been verified and your spot for ' + ev.name + ' is confirmed.\n\n' +
    details.map(function (d) { return d[0] + ': ' + d[1]; }).join('\n') + '\n' +
    (ev.notes ? '\n' + ev.notes + '\n' : '') +
    '\nRoll number on this registration: ' + r.roll_no + '\n' +
    'Keep this email — you may be asked to show it at the door.\n\n' +
    'See you there,\n' + SOCIETY + '\n';

  const rows = details.map(function (d) {
    return '<tr><td style="padding:4px 14px 4px 0;color:#8E7F74">' + esc_(d[0]) +
           '</td><td style="padding:4px 0;color:#F6EFE3"><b>' + esc_(d[1]) + '</b></td></tr>';
  }).join('');

  const html =
    '<div style="background:#0A0607;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#140B0C;border:1px solid #4E0509;' +
    'border-radius:14px;padding:28px 26px;color:#CDBFAE;line-height:1.6">' +
      '<p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:#E3A72F">PAYMENT VERIFIED</p>' +
      '<h1 style="margin:0 0 16px;font-size:26px;color:#F6EFE3">You\'re in, ' + esc_(name) + '.</h1>' +
      '<p style="margin:0 0 16px">Your payment has been verified and your spot for <b style="color:#F6D68A">' +
        esc_(ev.name) + '</b> is confirmed.</p>' +
      '<table style="border-collapse:collapse;margin:0 0 16px;font-size:15px">' + rows + '</table>' +
      (ev.notes ? '<p style="margin:0 0 16px">' + esc_(ev.notes) + '</p>' : '') +
      '<p style="margin:0 0 16px;font-size:13px;color:#8E7F74">Roll number on this registration: ' +
        esc_(r.roll_no) + '. Keep this email — you may be asked to show it at the door.</p>' +
      '<p style="margin:0;color:#E3A72F">' + esc_(SOCIETY) + '</p>' +
    '</div></div>';

  return { subject: 'You\'re in — ' + ev.name + ' | Bayaan', text: text, html: html };
}

/* names come from a public form — never put them into HTML unescaped */
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ── Supabase (plain REST, same as the website) ──────────────────────────── */

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

  const res = UrlFetchApp.fetch(url + '/rest/v1/' + path, opts);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Supabase ' + code + ': ' + res.getContentText().slice(0, 300));
  return method === 'get' ? JSON.parse(res.getContentText()) : null;
}

/* ── one-time helpers: run these by hand from the editor ─────────────────── */

/* 4. Is everything wired up? Reads, never writes, never emails. */
function checkConnection() {
  const waiting = sb_('get',
    'event_registrations?status=eq.verified&confirmation_sent_at=is.null&select=id');
  console.log('Connected to Supabase. ' + waiting.length + ' verified registration(s) are waiting for an email.');
  console.log('Gmail quota left today: ' + MailApp.getRemainingDailyQuota() + ' emails.');
}

/* 5. Sends a sample of each event's email to YOU only. Touches no registration. */
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  Object.keys(EVENTS).forEach(function (key) {
    const mail = buildEmail_({ event: key, full_name: 'Test Student', roll_no: '25M-0000', email: me });
    MailApp.sendEmail({ to: me, subject: '[TEST] ' + mail.subject, body: mail.text,
                        htmlBody: mail.html, name: SENDER });
  });
  console.log('Sample emails sent to ' + me + '.');
}

/* 6. Run once. Safe to run again — it replaces the old timer instead of stacking another. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendConfirmations') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendConfirmations').timeBased().everyMinutes(5).create();
  console.log('Timer installed: sendConfirmations runs every 5 minutes.');
}

/* Switch the automation off (e.g. after the events are over). */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendConfirmations') ScriptApp.deleteTrigger(t);
  });
  console.log('Timer removed. No more automatic emails.');
}
