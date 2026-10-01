/* ══════════════ SUPABASE — a 60-line REST client ══════════════
   No SDK and no build step, same rule as the rest of the site. Supabase's
   API is plain REST (PostgREST + GoTrue), so fetch is genuinely all it takes.

   The publishable key below is MEANT to be public — it identifies the project,
   it does not authorise anything. Row-level security is what actually protects
   the data, and it lives in supabase/schema.sql. Never put a service-role key
   in here; that one really is a master key.
   ═══════════════════════════════════════════════════════════════ */

const SB = (() => {

  const URL = (BAYAAN.config.supabaseUrl || '').replace(/\/+$/, '');
  const KEY = BAYAAN.config.supabaseKey || '';

  /* The site has to work with the form switched off — an unconfigured project
     shows a plain "not open yet" note rather than a broken form. */
  const configured = () => Boolean(URL && KEY);

  const TOKEN_KEY = 'bayaan.session';
  const session = {
    get:   () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; } },
    set:   (s) => localStorage.setItem(TOKEN_KEY, JSON.stringify(s)),
    clear: () => localStorage.removeItem(TOKEN_KEY)
  };

  const base = (extra = {}) => ({ apikey: KEY, 'Content-Type': 'application/json', ...extra });
  const auth = (extra = {}) => {
    const s = session.get();
    return base({ Authorization: `Bearer ${s ? s.access_token : KEY}`, ...extra });
  };

  async function fail(res) {
    let detail = '';
    try { const b = await res.json(); detail = b.message || b.error_description || b.error || b.hint || ''; }
    catch { /* not json — the status is all we have */ }
    const err = new Error(detail || `Request failed (${res.status})`);
    err.status = res.status;
    return err;
  }

  /* insert — `return=minimal` matters: anon has no SELECT on registrations, so
     asking PostgREST to echo the new row back would fail the request. */
  async function insert(table, row, { asUser = false } = {}) {
    /* `asUser` sends the signed-in admin's token instead of the anon key — needed
       for tables only an admin may write (broadcasts). The public forms never set it. */
    const res = await fetch(`${URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: (asUser ? auth : base)({ Prefer: 'return=minimal' }),
      body: JSON.stringify(row)
    });
    if (!res.ok) throw await fail(res);
  }

  async function select(table, query = '') {
    const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers: auth() });
    if (!res.ok) throw await fail(res);
    return res.json();
  }

  async function patch(table, query, body) {
    const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: auth({ Prefer: 'return=minimal' }),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await fail(res);
  }

  /* upload — a private bucket. Anyone may add a file; nobody may list, read or
     overwrite one (no `x-upsert`), see supabase/events.sql. */
  async function upload(bucket, path, file) {
    const res = await fetch(`${URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': file.type },
      body: file
    });
    if (!res.ok) throw await fail(res);
  }

  /* a short-lived link to a private file; only an admin's session can mint one */
  async function signedUrl(bucket, path, seconds = 300) {
    const res = await fetch(`${URL}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ expiresIn: seconds })
    });
    if (!res.ok) throw await fail(res);
    const { signedURL } = await res.json();
    return `${URL}/storage/v1${signedURL}`;
  }

  async function signIn(email, password) {
    const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: base(),
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw await fail(res);
    const s = await res.json();
    session.set(s);
    return s;
  }

  function signOut() { session.clear(); }

  return { configured, insert, select, patch, upload, signedUrl, signIn, signOut, session };
})();
