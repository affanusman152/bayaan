/* ══════════════ RENDER: data → DOM ══════════════ */

const Render = (() => {

  const esc = (s = '') => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  function ticker() {
    const row = document.getElementById('tickerRow');
    if (!row) return;
    const one = BAYAAN.ticker.map(t =>
      t.ur ? `<span class="ur">${esc(t.ur)}</span>` : `<span>${esc(t.en)}</span><b>◆</b>`
    ).join('');
    row.innerHTML = one + one;   // duplicated for the seamless -50% loop
  }

  /* The two halves the society is named after. A wing with no `family` still
     renders — it falls into the last group rather than vanishing. */
  const FAMILIES = [
    { key: 'speaking', label: 'Public Speaking', ur: 'فنِ خطابت', note: 'The podium, the floor, the committee room' },
    { key: 'literary', label: 'Literary',        ur: 'ادب',       note: 'The page, the stage, the open mic' }
  ];

  function wings() {
    const idx = document.getElementById('wingsIndex');
    if (!idx) return;

    const known = new Set(FAMILIES.map(f => f.key));
    let n = 0;

    idx.innerHTML = FAMILIES.map((f, fi) => {
      const last = fi === FAMILIES.length - 1;
      const mine = BAYAAN.wings.filter(w =>
        w.family === f.key || (last && !known.has(w.family))
      );
      if (!mine.length) return '';

      const rows = mine.map(w => {
        const num = String(++n).padStart(2, '0');
        return `
        <article class="wing">
          <span class="wing__wash" aria-hidden="true"></span>
          <span class="wing__num">${num}</span>
          <svg class="wing__icon" viewBox="0 0 72 72" aria-hidden="true">${w.icon}</svg>
          <div class="wing__body">
            <h3 class="wing__name">${esc(w.name)}</h3>
            <p class="wing__desc">${esc(w.desc)}</p>
            <div class="wing__tags">${w.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          </div>
          <p class="wing__ur">${esc(w.ur)}</p>
        </article>`;
      }).join('');

      return `
        <section class="fam">
          <header class="fam__head" data-reveal="up">
            <span class="fam__label">${esc(f.label)}</span>
            <span class="fam__ur">${esc(f.ur)}</span>
            <i></i>
            <span class="fam__note">${esc(f.note)}</span>
            <span class="fam__count">${mine.length} wings</span>
          </header>
          <div class="fam__rows">${rows}</div>
        </section>`;
    }).join('');
  }

  function ventures() {
    const tl = document.getElementById('timeline');
    if (!tl) return;
    const items = BAYAAN.ventures.map(v => `
      <article class="vt${v.flagship ? ' vt--flag' : ''}">
        <p class="vt__year">${esc(v.year)}${v.flagship ? '<b>The main event</b>' : ''}</p>
        <h3 class="vt__title">${esc(v.title)}</h3>
        ${v.ur ? `<p class="vt__ur">${esc(v.ur)}</p>` : ''}
        <div class="vt__meta">${v.meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>
        <p class="vt__desc">${esc(v.desc)}</p>
      </article>`).join('');

    tl.insertAdjacentHTML('beforeend', items + `
      <div class="vt__more" data-reveal="up">
        …and the list keeps growing. <b>Every semester adds more</b> — competitions,
        showcases, walks, workshops and whatever the council dreams up next.
      </div>`);
  }

  function team() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    let mi = 0;
    grid.innerHTML = BAYAAN.team.map(m => {
      if (m.band) {
        mi = 0;
        return `<div class="team__band" data-reveal="up"><span>${esc(m.band)}</span><i></i></div>`;
      }
      /* The portrait sits over the بیان placeholder rather than replacing it, and
         removes itself if the file is missing — so a half-finished set of photos
         degrades card by card instead of leaving holes. */
      const shot = m.photo
        ? `<img class="member__shot" src="${esc(m.photo)}" alt="" loading="lazy"
                decoding="async" onerror="this.remove()" />`
        : '';

      return `
        <article class="member" style="--mi:${mi++}">
          <span class="member__curtain" aria-hidden="true"></span>
          <span class="member__photo" aria-hidden="true">
            <img class="logo-img" src="${Logo.src}" alt="" />
            <b class="logo-fallback">بیان</b>
          </span>
          ${shot}
          <p class="member__role">${esc(m.role)}</p>
          <p class="member__name">${esc(m.name)}</p>
        </article>`;
    }).join('');
  }

  function join() {
    // the registration form itself is wired up in js/join.js
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function all() { ticker(); wings(); ventures(); team(); join(); }

  return { all };
})();
