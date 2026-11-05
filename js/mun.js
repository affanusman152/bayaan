/* ══════════════ MUN — the delegation form (mun.html) ══════════════
   One delegation head fills in every member, themselves first, then uploads ONE
   screenshot of the whole payment (delegates × BAYAAN.mun.fee). The image goes to
   the private `payment-proofs` bucket under mun/, and the delegation + members are
   written together by submit_mun_delegation() (supabase/mun.sql), which re-checks
   everything — validation here is courtesy. The page is reached only by its link.
   ─────────────────────────────────────────────────────────────────────────────── */

(function mun() {

  const cfg = BAYAAN.mun || {};
  const $ = (id) => document.getElementById(id);

  if (!SB.configured() || !cfg.open || !cfg.key) {
    if (SB.configured() && cfg.open) $('munShutHead').textContent = 'This form is not set up yet.';
    $('munShut').hidden = false;
    return;
  }

  const form = $('munForm'), list = $('munList'), status = $('munStatus'), send = $('munSend');
  const FEE = Number(cfg.fee) || 0;
  const MAX_N = Math.min(Number(cfg.maxDelegates) || 30, 30);        // the database stops at 30
  const COMMITTEES = (cfg.committees || []).filter(Boolean);
  const DRAFT = 'bayaan.mun.draft.' + cfg.key;

  const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_BYTES = 5 * 1024 * 1024;                                  // mirrors the bucket's own limit

  const FIELDS = ['full_name', 'roll_no', 'section', 'email', 'phone',
                  'committee_1', 'committee_2', 'committee_3', 'experience'];
  const EXPERIENCE = [['none', 'First MUN'], ['1-2', '1–2 before'], ['3+', '3 or more']];

  const blank = () => Object.fromEntries(FIELDS.map(f => [f, '']));
  const esc = (s = '') => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
  const pkr = (n) => 'PKR ' + n.toLocaleString('en-US');
  const two = (i) => String(i + 1).padStart(2, '0');

  /* ── the draft: ten people's details are too many to lose to a refresh ── */
  const load = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (Array.isArray(d) && d.length) return d.slice(0, MAX_N).map(x => ({ ...blank(), ...x }));
    } catch { /* a broken draft is just discarded */ }
    return [blank()];
  };
  let people = load();
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(people)); } catch { /* private mode */ } };

  /* ── paint the fixed parts ── */
  $('munTitle').textContent = (cfg.name || 'MUN') + ' — delegation';
  $('munSub').textContent = cfg.blurb || '';
  document.title = (cfg.name || 'MUN') + ' delegation — Bayaan';
  $('munFee').innerHTML =
    '<p class="mun__fee-main"><b>' + esc(pkr(FEE)) + '</b> per delegate</p>' +
    '<p class="mun__fee-perk">No delegation fee</p>' +
    (cfg.regular ? '<p class="mun__fee-reg"><s>' + esc(cfg.regular) + '</s></p>' : '');

  const p = cfg.pay || {};
  const payRows = [['Send to', p.method], ['Account title', p.title], ['Account', p.account]].filter(([, v]) => v);
  $('munPay').innerHTML = payRows.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');
  $('munPay').hidden = !payRows.length;
  $('munMain').hidden = false;

  /* ── one card per delegate ── */
  function field(i, name, label, attrs, { req = true, hint = '' } = {}) {
    return '<label class="fld">' +
      '<span class="fld__label">' + label + (req ? ' <i>*</i>' : '') + '</span>' +
      '<input class="fld__in" name="' + name + '" data-i="' + i + '" value="' + esc(people[i][name]) + '" ' + attrs + ' />' +
      (hint ? '<span class="mun__hint">' + hint + '</span>' : '') +
      '<em class="fld__err" data-err="' + i + '-' + name + '"></em>' +
    '</label>';
  }

  /* a dropdown once the committee list is in data.js; free text until then */
  function committee(i, n) {
    const name = 'committee_' + n, req = n === 1;
    const label = ['', '1st choice', '2nd choice', '3rd choice'][n];
    if (!COMMITTEES.length) {
      return field(i, name, label, 'type="text" maxlength="60" placeholder="' + (req ? 'e.g. UNSC' : 'optional') + '"', { req });
    }
    const v = people[i][name];
    return '<label class="fld">' +
      '<span class="fld__label">' + label + (req ? ' <i>*</i>' : '') + '</span>' +
      '<select class="fld__in" name="' + name + '" data-i="' + i + '">' +
        '<option value="">' + (req ? 'Choose a committee' : '— none —') + '</option>' +
        COMMITTEES.map(c => '<option' + (c === v ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select>' +
      '<em class="fld__err" data-err="' + i + '-' + name + '"></em>' +
    '</label>';
  }

  function card(i) {
    const head = i === 0;
    const exp = people[i].experience;
    return '<section class="mun__card" data-card="' + i + '" aria-labelledby="munCard' + i + '">' +
      '<header class="mun__cardhead">' +
        '<h3 id="munCard' + i + '"><em>' + two(i) + '</em> ' + (head ? 'You — delegation head' : 'Delegate') + '</h3>' +
        (head ? '' : '<button class="mun__rm" type="button" data-rm="' + i + '" aria-label="Remove delegate ' + two(i) + '">Remove</button>') +
      '</header>' +
      '<div class="reg__grid">' +
        field(i, 'full_name', 'Full name', 'type="text" maxlength="80"' + (head ? ' autocomplete="name"' : '')) +
        field(i, 'roll_no', 'Roll number', 'type="text" maxlength="24" placeholder="25M-0524"') +
        field(i, 'section', 'Section', 'type="text" maxlength="20" placeholder="BCS-3A"') +
        field(i, 'email', 'Email', 'type="email" maxlength="120"' + (head ? ' autocomplete="email"' : '')) +
        field(i, 'phone', 'WhatsApp number', 'type="tel" maxlength="24" placeholder="03xx-xxxxxxx"' + (head ? ' autocomplete="tel"' : ''),
              { hint: head ? 'The society contacts the delegation through you.' : '' }) +
      '</div>' +
      '<fieldset class="reg__wings mun__prefs">' +
        '<legend>Committee preference</legend>' +
        '<div class="mun__prefgrid">' + committee(i, 1) + committee(i, 2) + committee(i, 3) + '</div>' +
      '</fieldset>' +
      '<fieldset class="reg__wings">' +
        '<legend>MUN experience <i>*</i></legend>' +
        '<div class="wingpick mun__exp">' +
          EXPERIENCE.map(([v, t]) =>
            '<label class="wingpick__opt">' +
              '<input type="radio" name="experience_' + i + '" data-i="' + i + '" data-f="experience" value="' + v + '"' + (exp === v ? ' checked' : '') + ' />' +
              '<span class="wingpick__box" aria-hidden="true"></span>' +
              '<span class="wingpick__name">' + t + '</span>' +
            '</label>').join('') +
        '</div>' +
        '<em class="fld__err" data-err="' + i + '-experience"></em>' +
      '</fieldset>' +
    '</section>';
  }

  function paint() {
    list.innerHTML = people.map((_, i) => card(i)).join('');
    paintTotal();
  }

  function paintTotal() {
    const n = people.length;
    $('munTotal').innerHTML = n + ' delegate' + (n === 1 ? '' : 's') + ' × ' + esc(pkr(FEE)) +
      ' = <b>' + esc(pkr(n * FEE)) + '</b><span>Send this amount in one transfer.</span>';
    $('munAdd').hidden = n >= MAX_N;
    $('munAdd').querySelector('span').textContent = '+ Add a delegate (' + (n + 1) + ')';
  }

  /* ── typing updates the model; the DOM is only rebuilt on add / remove ── */
  list.addEventListener('input', onEdit);
  list.addEventListener('change', onEdit);
  function onEdit(e) {
    const el = e.target, i = Number(el.dataset.i);
    if (!people[i]) return;
    const f = el.dataset.f || el.name;
    people[i][f] = el.value;
    setErr(i, f, '');
    save();
  }

  $('munAdd').addEventListener('click', () => {
    if (people.length >= MAX_N) return;
    people.push(blank());
    save();
    paint();
    list.querySelector('[data-card="' + (people.length - 1) + '"] input').focus();
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    const i = Number(btn.dataset.rm);
    const who = people[i].full_name.trim();
    if (who && !confirm('Remove ' + who + ' from the delegation?')) return;
    people.splice(i, 1);
    save();
    paint();
    const back = list.querySelector('[data-card="' + Math.min(i, people.length - 1) + '"] input');
    if (back) back.focus({ preventScroll: true });
  });

  /* ── validate ── */
  function setErr(i, f, msg) {
    const slot = list.querySelector('[data-err="' + i + '-' + f + '"]');
    if (slot) slot.textContent = msg || '';
    const el = list.querySelector('[name="' + f + '"][data-i="' + i + '"]');
    if (el) el.classList.toggle('is-bad', Boolean(msg));
    return !msg;
  }

  function validate() {
    let ok = true;
    const seen = {};
    people.forEach((d, i) => {
      const v = (f) => (d[f] || '').trim();
      const roll = v('roll_no').toLowerCase();
      const twice = roll && seen[roll] !== undefined;
      if (roll && !twice) seen[roll] = i;

      ok = [
        setErr(i, 'full_name',   v('full_name').length < 2 ? 'Full name, please.' : ''),
        setErr(i, 'roll_no',     v('roll_no').length < 3 ? 'Roll number, e.g. 25M-0524.'
                                 : twice ? 'Same roll number as delegate ' + two(seen[roll]) + '.' : ''),
        setErr(i, 'section',     v('section').length < 1 ? 'Section, e.g. BCS-3A.' : ''),
        setErr(i, 'email',       /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email')) ? '' : 'That email does not look right.'),
        setErr(i, 'phone',       v('phone').replace(/\D/g, '').length < 10 ? 'A WhatsApp number, e.g. 0300-1234567.' : ''),
        setErr(i, 'committee_1', v('committee_1').length < 2 ? 'At least a first choice.' : ''),
        setErr(i, 'experience',  v('experience') ? '' : 'Pick one.')
      ].every(Boolean) && ok;
    });

    const file = form.elements.proof.files[0];
    let fileMsg = '';
    if (!file)                       fileMsg = 'Attach the screenshot of the payment.';
    else if (!TYPES[file.type])      fileMsg = 'That needs to be a JPG, PNG or WebP image.';
    else if (file.size > MAX_BYTES)  fileMsg = 'That image is over 5 MB — please send a smaller one.';
    $('mun_err_proof').textContent = fileMsg;
    form.elements.proof.classList.toggle('is-bad', Boolean(fileMsg));

    return ok && !fileMsg ? file : null;
  }
  form.elements.proof.addEventListener('change', () => {
    $('mun_err_proof').textContent = '';
    form.elements.proof.classList.remove('is-bad');
  });

  /* ── submit ── */
  let uploaded = null;   // { file, path } — a retry after a failed save reuses the image instead of uploading it twice

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'reg__status';
    status.textContent = '';

    if (form.elements.website.value) { finish(); return; }        // honeypot: pretend it worked

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
      if (!uploaded || uploaded.file !== file) {
        const id = (crypto.randomUUID && crypto.randomUUID()) ||
                   (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        const path = 'mun/' + id + '.' + TYPES[file.type];
        await SB.upload('payment-proofs', path, file);
        uploaded = { file, path };
      }

      await SB.rpc('submit_mun_delegation', {
        conference: cfg.key,
        proof_path: uploaded.path,
        delegates: people.map(d => Object.fromEntries(FIELDS.map(f => [f, (d[f] || '').trim()])))
      });
      finish();
    } catch (err) {
      send.disabled = false;
      send.querySelector('span').textContent = 'Send delegation';
      status.className = 'reg__status is-bad';
      /* the database's own messages name the roll number at fault; anything else gets the generic line */
      status.textContent = (err.status === 409 || err.status === 400) && /roll number|screenshot|delegat/i.test(err.message)
        ? err.message
        : 'Could not send that: ' + err.message + '. Please try again, or reach us on Instagram.';
      if (/screenshot/i.test(err.message)) uploaded = null;
    }
  });

  function finish() {
    const n = people.length;
    $('munDoneNote').textContent =
      n + ' delegate' + (n === 1 ? '' : 's') + ' · ' + pkr(n * FEE) + '. ' +
      'The society will check the payment and get in touch with you on WhatsApp.';
    try { localStorage.removeItem(DRAFT); } catch { /* fine */ }
    form.hidden = true;
    $('munDone').hidden = false;
    $('munDone').focus();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('munAgain').addEventListener('click', () => {
    people = [blank()];
    uploaded = null;
    form.reset();
    status.textContent = '';
    send.disabled = false;
    send.querySelector('span').textContent = 'Send delegation';
    paint();
    $('munDone').hidden = true;
    form.hidden = false;
    list.querySelector('input').focus();
  });

  paint();
})();
