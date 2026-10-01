/* ══════════════ EVENTS — the registration popup ══════════════
   Pops up when the site opens (once per visit, and never again for someone who
   has already registered) and stays reachable from a small pill. Name, roll
   number, email and a payment screenshot go straight to Supabase: the image to
   a private bucket, the rest to `event_registrations`. As with the join form,
   validation here is courtesy — the database and the bucket re-check it all
   (supabase/events.sql). ─────────────────────────────────────────────────── */

const Events = (() => {

  const cfg   = BAYAAN.events || {};
  const modal = document.getElementById('evModal');
  const form  = document.getElementById('evForm');
  const pill  = document.getElementById('evPill');

  /* Absent on the admin page, and inert until configured and switched on. */
  if (!modal || !form || !cfg.open || !(cfg.list || []).length) return { init(){} };

  const $ = (id) => document.getElementById(id);
  const card = modal.querySelector('.evm__card');
  const done = $('evDone'), status = $('evStatus'), send = $('evSend'), picker = $('evPick');

  const SEEN = 'bayaan.ev.seen';     // sessionStorage — popped up already this visit
  const DONE = 'bayaan.ev.done';     // localStorage   — this browser has registered
  const store = (area, k, v) => { try { return v === undefined ? window[area].getItem(k) : window[area].setItem(k, v); } catch { return null; } };

  const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX   = 5 * 1024 * 1024;          // mirrors the bucket's own limit

  let isOpen = false, lastFocus = null;

  const esc = (s = '') => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  /* ── paint ── */
  function paint() {
    $('evSub').textContent = cfg.blurb || '';

    picker.innerHTML = cfg.list.map(e => `
      <label class="wingpick__opt">
        <input type="radio" name="event" value="${esc(e.key)}" />
        <span class="wingpick__box" aria-hidden="true"></span>
        <span class="wingpick__name">${esc(e.name)}</span>
        <span class="wingpick__ur">${esc(e.ur || '')}</span>
      </label>`).join('');

    /* a single event needs no choosing */
    if (cfg.list.length === 1) {
      picker.querySelector('input').checked = true;
      $('evPickWrap').hidden = true;
    }

    const p = cfg.pay || {};
    const rows = [['Fee', p.fee], ['Send to', p.method], ['Account title', p.title], ['Account', p.account]]
      .filter(([, v]) => v);
    $('evPay').innerHTML = rows.length
      ? rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')
      : '<p class="evm__soon">Payment details will appear here shortly.</p>';

    pill.querySelector('span').textContent =
      'Register · ' + cfg.list.map(e => e.name).join(' & ');
  }

  /* ── open / close ── */
  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    store('sessionStorage', SEEN, '1');

    modal.hidden = false;
    pill.hidden = true;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => modal.classList.add('is-on'));
    /* focus the card, not a field: a field would raise the phone keyboard over
       the very popup the visitor has not read yet */
    setTimeout(() => card.focus({ preventScroll: true }), 380);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('is-on');
    document.body.classList.remove('is-locked');
    setTimeout(() => { if (!isOpen) { modal.hidden = true; pill.hidden = false; } }, 420);
    lastFocus?.focus?.({ preventScroll: true });
  }

  /* ── validate ── */
  const val = (n) => (form.elements[n]?.value || '').trim();

  function setErr(name, msg) {
    const slot = document.getElementById('ev_err_' + name);
    if (slot) slot.textContent = msg || '';
    const field = form.elements[name];
    if (field && field.classList && !(field instanceof RadioNodeList)) field.classList.toggle('is-bad', Boolean(msg));
    return !msg;
  }

  function validate() {
    const file = form.elements.proof.files[0];
    let fileMsg = '';
    if (!file)                     fileMsg = 'Attach the screenshot of your payment.';
    else if (!TYPES[file.type])    fileMsg = 'That needs to be a JPG, PNG or WebP image.';
    else if (file.size > MAX)      fileMsg = 'That image is over 5 MB — please send a smaller one.';

    return [
      setErr('event',     form.elements.event.value ? '' : 'Pick an event.'),
      setErr('full_name', val('full_name').length < 2 ? 'Please tell us your name.' : ''),
      setErr('roll_no',   val('roll_no').length   < 3 ? 'Your roll number, e.g. 25M-0524.' : ''),
      setErr('email',     /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('email')) ? '' : 'That email does not look right.'),
      setErr('proof',     fileMsg)
    ].every(Boolean) ? file : null;
  }

  const objectName = (type) => {
    const id = (crypto.randomUUID && crypto.randomUUID()) ||
               (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    return `${id}.${TYPES[type]}`;
  };

  /* ── submit ── */
  async function submit(e) {
    e.preventDefault();
    status.className = 'reg__status';
    status.textContent = '';

    /* the honeypot — pretend it worked so a bot learns nothing */
    if (val('website')) { finish(); return; }

    const file = validate();
    if (!file) {
      status.className = 'reg__status is-bad';
      status.textContent = 'Some fields need a look.';
      form.querySelector('.is-bad')?.focus();
      return;
    }

    send.disabled = true;
    send.querySelector('span').textContent = 'Sending…';

    try {
      /* image first: the row has to point at a file that exists. A failed row
         after a good upload leaves one stray, unreadable image — harmless. */
      const path = objectName(file.type);
      await SB.upload('payment-proofs', path, file);

      await SB.insert('event_registrations', {
        event:      form.elements.event.value,
        full_name:  val('full_name'),
        roll_no:    val('roll_no'),
        email:      val('email').toLowerCase(),
        proof_path: path
      });
      store('localStorage', DONE, '1');
      finish();
    } catch (err) {
      send.disabled = false;
      send.querySelector('span').textContent = 'Send registration';
      status.className = 'reg__status is-bad';
      status.textContent = err.status === 409
        ? 'That roll number is already registered for this event.'
        : `Could not send that: ${err.message}. Please try again, or reach us on Instagram.`;
    }
  }

  function finish() {
    form.hidden = true;
    done.hidden = false;
    $('evDoneClose').focus({ preventScroll: true });
  }

  /* ── wire ── */
  function init() {
    paint();
    pill.hidden = false;

    modal.addEventListener('click', (e) => { if (e.target.closest('[data-ev-close]')) close(); });
    pill.addEventListener('click', open);
    form.addEventListener('submit', submit);

    /* a friend sharing the same phone, or one person doing both events */
    $('evAgain').addEventListener('click', () => {
      form.reset();
      form.querySelectorAll('.is-bad').forEach(el => el.classList.remove('is-bad'));
      form.querySelectorAll('.fld__err').forEach(el => { el.textContent = ''; });
      status.textContent = '';
      send.disabled = false;
      send.querySelector('span').textContent = 'Send registration';
      done.hidden = true;
      form.hidden = false;
      form.querySelector('input')?.focus({ preventScroll: true });
    });

    /* an inline error clears the moment the field is touched */
    form.addEventListener('input', (e) => { if (e.target.name) setErr(e.target.name, ''); });
    form.addEventListener('change', (e) => { if (e.target.name) setErr(e.target.name, ''); });

    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {                                   // focus trap
        const f = [...modal.querySelectorAll('input, button, a')]
          .filter(el => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* pop up once the intro curtain has cleared — not for someone who has already
       registered, and not twice in the same visit */
    document.addEventListener('bayaan:ready', () => {
      if (store('sessionStorage', SEEN) || store('localStorage', DONE)) return;
      setTimeout(open, 500);
    }, { once: true });
  }

  return { init, open, close };
})();
