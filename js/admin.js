/* ══════════════ ADMIN — the registrations board ══════════════
   Reads and triages submissions. Nothing here is a security boundary: the
   database decides what this page may see. An account that signs in but is not
   listed in `admins` gets an empty list, because the RLS policy says so — not
   because this file hid anything. ────────────────────────────────────────── */

(function admin() {

  const $ = (id) => document.getElementById(id);
  const setup = $('adSetup'), gate = $('adGate'), board = $('adBoard');
  const rows = $('adRows'), note = $('adNote'), count = $('adCount');

  let all = [];

  const esc = (s = '') => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  const show = (el) => { [setup, gate, board].forEach(p => p.hidden = true); el.hidden = false; };

  /* ── boot ── */
  if (!SB.configured()) { show(setup); return; }
  if (SB.session.get()) enter(); else show(gate);

  /* ── sign in ── */
  $('adLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('adGo'), err = $('adErr');
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await SB.signIn($('adUser').value.trim(), $('adPass').value);
      enter();
    } catch (ex) {
      err.textContent = ex.status === 400
        ? 'That email and password did not match.'
        : ex.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  $('adOut').addEventListener('click', () => { SB.signOut(); location.reload(); });

  function enter() {
    const s = SB.session.get();
    $('adWho').hidden = false;
    $('adEmail').textContent = (s && s.user && s.user.email) || '';
    show(board);
    load();
  }

  /* ── load ── */
  async function load() {
    note.textContent = 'Loading…';
    try {
      all = await SB.select('registrations', 'select=*&order=created_at.desc');
      note.textContent = '';
      paint();
      if (!all.length) {
        note.textContent =
          'No submissions yet. If you expected some, check that your account is in the ' +
          'admins table — row-level security returns an empty list rather than an error.';
      }
    } catch (ex) {
      /* an expired token is the common one, and it reads like a permissions bug
         unless we say plainly what happened */
      if (ex.status === 401) {
        SB.signOut();
        show(gate);
        $('adErr').textContent = 'That session expired. Please sign in again.';
        return;
      }
      note.textContent = 'Could not load: ' + ex.message;
    }
  }

  $('adRefresh').addEventListener('click', load);
  $('adSearch').addEventListener('input', paint);
  $('adStatus').addEventListener('change', paint);

  function visible() {
    const q = $('adSearch').value.trim().toLowerCase();
    const st = $('adStatus').value;
    return all.filter(r => {
      if (st && r.status !== st) return false;
      if (!q) return true;
      return [r.full_name, r.roll_no, r.email, r.phone, r.batch, r.department, (r.wings || []).join(' ')]
        .join(' ').toLowerCase().includes(q);
    });
  }

  const when = (iso) => new Date(iso).toLocaleString(undefined,
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const STATUSES = ['new', 'shortlisted', 'accepted', 'rejected'];

  function paint() {
    const list = visible();
    count.textContent = list.length === all.length
      ? all.length + ' total'
      : list.length + ' of ' + all.length;

    rows.innerHTML = list.map(r => {
      const opts = STATUSES.map(s =>
        '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + s + '</option>'
      ).join('');
      const tags = (r.wings || []).map(w => '<span class="ad__tag">' + esc(w) + '</span>').join('');

      return '' +
      '<tr class="ad__row" data-id="' + r.id + '">' +
        '<td><button class="ad__more" type="button" aria-label="Show details">+</button></td>' +
        '<td class="ad__dim">' + esc(when(r.created_at)) + '</td>' +
        '<td><b>' + esc(r.full_name) + '</b></td>' +
        '<td class="ad__mono">' + esc(r.roll_no) + '</td>' +
        '<td>' +
          '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a><br />' +
          '<a class="ad__dim" href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' +
        '</td>' +
        '<td class="ad__dim">' + esc([r.batch, r.department].filter(Boolean).join(' · ') || '—') + '</td>' +
        '<td>' + tags + '</td>' +
        '<td><select class="ad__st ad__st--' + esc(r.status) + '" data-id="' + r.id + '">' + opts + '</select></td>' +
      '</tr>' +
      '<tr class="ad__detail" data-for="' + r.id + '" hidden>' +
        '<td colspan="8"><div class="ad__detail-grid">' +
          '<div><h4>Done before</h4><p>' + esc(r.experience || '—') + '</p></div>' +
          '<div><h4>Why Bayaan</h4><p>' + esc(r.why || '—') + '</p></div>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  /* expand / collapse, delegated so it survives every repaint */
  rows.addEventListener('click', (e) => {
    const btn = e.target.closest('.ad__more');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const d = rows.querySelector('.ad__detail[data-for="' + id + '"]');
    d.hidden = !d.hidden;
    btn.textContent = d.hidden ? '+' : '−';
  });

  /* triage */
  rows.addEventListener('change', async (e) => {
    const sel = e.target.closest('.ad__st');
    if (!sel) return;
    const id = sel.dataset.id;
    const status = sel.value;
    const row = all.find(r => r.id === id);
    const was = row.status;

    sel.disabled = true;
    try {
      await SB.patch('registrations', 'id=eq.' + id, { status });
      row.status = status;
      sel.className = 'ad__st ad__st--' + status;
      note.textContent = '';
    } catch (ex) {
      sel.value = was;                      // put it back rather than lie about it
      note.textContent = 'Could not save that: ' + ex.message;
    } finally {
      sel.disabled = false;
    }
  });

  /* ── CSV ── */
  $('adCsv').addEventListener('click', () => {
    const cols = ['created_at', 'full_name', 'roll_no', 'email', 'phone',
                  'batch', 'department', 'wings', 'experience', 'why', 'status'];

    /* the leading apostrophe matters: a cell starting = + - @ is run as a formula
       by Excel and Sheets, which is a genuine attack route through a public form */
    const cell = (v) => {
      let s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const csv = [cols.join(',')]
      .concat(visible().map(r => cols.map(c => cell(r[c])).join(',')))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'bayaan-registrations-' + new Date().toISOString().slice(0, 10) + '.csv'
    });
    a.click();
    URL.revokeObjectURL(url);
  });
})();
