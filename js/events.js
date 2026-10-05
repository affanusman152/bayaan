/* ══════════════ EVENTS — the registration popup ══════════════
   Pops up when the site opens (once per visit, and never again for someone who
   has already registered) and stays reachable from a small pill. Name, roll
   number, section, email and a payment screenshot go straight to Supabase: the image to
   a private bucket, the rest to `event_registrations`. As with the join form,
   validation here is courtesy — the database and the bucket re-check it all
   (supabase/events.sql). ─────────────────────────────────────────────────── */

const Events = (() => {

  const cfg   = BAYAAN.events || {};
  const modal = document.getElementById('evModal');
  const form  = document.getElementById('evForm');
  const pill  = document.getElementById('evPill');

  /* events still taking registrations — `hidden` ones stay defined but out of sight */
  const LIST = (cfg.list || []).filter(e => !e.hidden);

  /* Absent on the admin page, and inert until configured and switched on. */
  if (!modal || !form || !cfg.open || !LIST.length) return { init(){} };

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
    $('evTitle').textContent = cfg.title || 'Event registration';
    $('evSub').textContent = cfg.blurb || '';

    picker.innerHTML = LIST.map(e => `
      <label class="wingpick__opt">
        <input type="radio" name="event" value="${esc(e.key)}" />
        <span class="wingpick__box" aria-hidden="true"></span>
        <span class="wingpick__name">${esc(e.name)}</span>
        <span class="wingpick__ur">${esc(e.ur || '')}</span>
      </label>`).join('');

    /* a single event needs no choosing */
    if (LIST.length === 1) {
      picker.querySelector('input').checked = true;
      $('evPickWrap').hidden = true;
    }
    paintIncludes();

    const p = cfg.pay || {};
    const rows = [['Fee', p.fee], ['Send to', p.method], ['Account title', p.title], ['Account', p.account]]
      .filter(([, v]) => v);
    $('evPay').innerHTML = rows.length
      ? rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')
      : '<p class="evm__soon">Payment details will appear here shortly.</p>';

    pill.querySelector('span').textContent =
      'Register · ' + LIST.map(e => e.name).join(' & ');

    paintEntries();
  }

  /* ── the other doors in ──
     Everything marked [data-ev-open] (top-bar button, hero chip, drawer item,
     the home-page ticket) is hidden in the markup and switched on here, so
     `open: false` in data.js clears every one of them along with the popup. */
  function paintEntries() {
    const names = LIST.map(e => e.name).join(' & ');
    const fee = (cfg.pay || {}).fee;
    const tracks = LIST.flatMap(e => e.includes || []);

    $('evChipTxt').textContent = `${names} registration open` + (fee ? ` · ${fee}` : '');
    $('drawerEvName').textContent = names;

    $('evtName').textContent = names;
    $('evtUr').textContent = LIST.length === 1 ? (LIST[0].ur || '') : '';
    $('evtTracks').innerHTML = tracks.map((t, i) =>
      `<li><em>${String(i + 1).padStart(2, '0')}</em>${esc(t)}</li>`).join('');
    $('evtPerk').textContent = LIST.map(e => e.perk).filter(Boolean).join(' · ');
    $('evtFee').textContent = fee || '';
    $('evtFee').hidden = !fee;

    document.querySelectorAll('[data-ev-open]').forEach(el => { el.hidden = false; });
    $('evTicket').hidden = false;
    document.querySelector('.drawer__ev').hidden = false;
  }

  /* a link someone can share: /?register or /#/register opens the form even for a
     browser that has already seen it or already registered */
  const wantsForm = () => /[?&]register\b/.test(location.search) || /^#\/?register/.test(location.hash);

  /* "your registration covers…" — follows whichever event is selected */
  function paintIncludes() {
    const box = $('evIncl');
    const ev = LIST.find(e => e.key === form.elements.event.value);
    const items = (ev && ev.includes) || [];
    box.hidden = !items.length;
    box.innerHTML = items.length
      ? `<p class="evm__incl-head">One registration covers ${items.length === 2 ? 'both' : 'all'}</p>
         <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '';
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
      setErr('section',   val('section').length   < 1 ? 'Your section, e.g. BCS-3A.' : ''),
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
        section:    val('section'),
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

    /* every other door: the top-bar button, hero chip, drawer item and ticket.
       From the drawer, let it slide shut first so the two never fight over focus. */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-ev-open]')) return;
      e.preventDefault();
      if (typeof Drawer !== 'undefined' && Drawer.isOpen) { Drawer.close(); setTimeout(open, 320); }
      else open();
    });
    addEventListener('hashchange', () => { if (wantsForm()) open(); });

    /* the pill is the fallback door: the top bar slides away on scroll, so it
       steps in once the hero chip is behind us, and steps back while the ticket
       itself is on screen — no point offering the same button twice */
    let ticketInView = false, ticking = false;
    const placePill = () => {
      ticking = false;
      pill.classList.toggle('is-away', scrollY < 420 || ticketInView);
    };
    new IntersectionObserver(([en]) => { ticketInView = en.isIntersecting; placePill(); })
      .observe($('evTicket'));
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(placePill); } }, { passive: true });
    addEventListener('hashchange', placePill);
    placePill();

    /* a friend sharing the same phone, or one person doing both events */
    $('evAgain').addEventListener('click', () => {
      form.reset();
      if (LIST.length === 1) picker.querySelector('input').checked = true;   // reset() unticks it
      paintIncludes();
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
    form.addEventListener('change', (e) => {
      if (e.target.name) setErr(e.target.name, '');
      if (e.target.name === 'event') paintIncludes();
    });

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
       registered, and not twice in the same visit. A shared /?register link
       overrides both. */
    document.addEventListener('bayaan:ready', () => {
      if (!wantsForm() && (store('sessionStorage', SEEN) || store('localStorage', DONE))) return;
      setTimeout(open, 500);
    }, { once: true });
  }

  return { init, open, close };
})();
