/* ══════════════ JOIN — the registration form ══════════════
   Validates in the browser for speed and politeness, but the database
   re-checks everything (see supabase/schema.sql). Client-side validation is
   UX, never security: anyone can POST straight past this file. ────────── */

const Join = (() => {

  const form   = document.getElementById('regForm');
  const shut   = document.getElementById('regShut');
  const status = document.getElementById('regStatus');
  const picker = document.getElementById('wingPick');
  const send   = document.getElementById('regSend');

  /* Neither element exists on the admin page, so bail quietly there. */
  if (!form || !shut) return { init(){} };

  function init() {
    /* No project configured yet → show the "not open" note instead of a form
       that could only ever fail. */
    if (!SB.configured()) { shut.hidden = false; return; }

    form.hidden = false;
    paintWings();
    form.addEventListener('submit', submit);
  }

  function paintWings() {
    if (!picker) return;
    picker.innerHTML = BAYAAN.wings.map((w, i) => `
      <label class="wingpick__opt">
        <input type="checkbox" name="wings" value="${w.name.replace(/"/g, '&quot;')}" />
        <span class="wingpick__box" aria-hidden="true"></span>
        <span class="wingpick__name">${w.name}</span>
        <span class="wingpick__ur">${w.ur}</span>
      </label>`).join('');
  }

  const val = (n) => (form.elements[n]?.value || '').trim();

  function setErr(name, msg) {
    const field = form.elements[name];
    const slot  = name === 'wings'
      ? document.getElementById('wingsErr')
      : field?.closest('.fld')?.querySelector('.fld__err');
    if (slot) slot.textContent = msg || '';
    if (field && field.classList) field.classList.toggle('is-bad', Boolean(msg));
    return !msg;
  }

  function checked() {
    return [...form.querySelectorAll('input[name="wings"]:checked')].map(c => c.value);
  }

  function validate() {
    const wings = checked();
    /* every check runs, so the reader sees every problem at once rather than
       fixing one, resubmitting, and being told about the next */
    const ok = [
      setErr('full_name', val('full_name').length < 2 ? 'Please tell us your name.' : ''),
      setErr('roll_no',   val('roll_no').length   < 3 ? 'Your roll number, e.g. 25M-0524.' : ''),
      setErr('email',     /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('email')) ? '' : 'That email does not look right.'),
      setErr('phone',     val('phone').replace(/\D/g, '').length < 7 ? 'A number we can reach you on.' : ''),
      setErr('wings',     wings.length ? '' : 'Pick at least one wing.')
    ].every(Boolean);
    return ok ? wings : null;
  }

  async function submit(e) {
    e.preventDefault();
    status.className = 'reg__status';
    status.textContent = '';

    /* the honeypot — invisible to people, irresistible to bots. Pretend it
       worked so a scripted submitter has nothing to learn from the response. */
    if (val('website')) { done(); return; }

    const wings = validate();
    if (!wings) {
      status.className = 'reg__status is-bad';
      status.textContent = 'Some fields need a look.';
      form.querySelector('.is-bad')?.focus();
      return;
    }

    send.disabled = true;
    send.querySelector('span').textContent = 'Sending…';

    try {
      await SB.insert('registrations', {
        full_name:  val('full_name'),
        roll_no:    val('roll_no'),
        email:      val('email').toLowerCase(),
        phone:      val('phone'),
        batch:      val('batch')      || null,
        department: val('department') || null,
        wings,
        experience: val('experience') || null,
        why:        val('why')        || null
      });
      done();
    } catch (err) {
      send.disabled = false;
      send.querySelector('span').textContent = 'Send my registration';
      status.className = 'reg__status is-bad';

      /* 409 is the unique index on roll_no doing its job */
      status.textContent = err.status === 409
        ? 'That roll number is already registered — you are on the list.'
        : `Could not send that: ${err.message}. Please try again, or reach us on Instagram.`;
    }
  }

  function done() {
    form.hidden = true;
    shut.hidden = false;
    shut.innerHTML = `
      <p class="reg__shut-head">You're on the list.</p>
      <p class="reg__shut-note">
        We'll email you before the induction. Bring nothing but yourself.
      </p>`;
    shut.scrollIntoView({ behavior: Motion.REDUCED ? 'auto' : 'smooth', block: 'center' });
  }

  return { init };
})();
