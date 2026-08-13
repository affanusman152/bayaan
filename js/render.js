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

  function wings() {
    const rail = document.getElementById('wingsRail');
    if (!rail) return;
    rail.innerHTML = BAYAAN.wings.map((w, i) => `
      <article class="wing" role="listitem">
        <span class="wing__num">WING ${String(i + 1).padStart(2, '0')}</span>
        <svg class="wing__icon" viewBox="0 0 72 72" aria-hidden="true">${w.icon}</svg>
        <p class="wing__ur">${esc(w.ur)}</p>
        <h3 class="wing__name">${esc(w.name)}</h3>
        <p class="wing__desc">${esc(w.desc)}</p>
        <div class="wing__tags">${w.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </article>`).join('');

    Motion.railDots(rail, document.getElementById('wingsDots'));
  }

  function ventures() {
    const tl = document.getElementById('timeline');
    if (!tl) return;
    const items = BAYAAN.ventures.map(v => `
      <article class="vt">
        <p class="vt__year">${esc(v.year)}</p>
        <h3 class="vt__title">${esc(v.title)}</h3>
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
      return `
        <article class="member" style="--mi:${mi++}">
          <span class="member__curtain" aria-hidden="true"></span>
          <span class="member__photo" aria-hidden="true">
            <img class="logo-img" src="${Logo.src}" alt="" />
            <b class="logo-fallback">بیان</b>
          </span>
          <p class="member__role">${esc(m.role)}</p>
          <p class="member__name">${esc(m.name)}</p>
        </article>`;
    }).join('');
  }

  function join() {
    const btn = document.getElementById('joinBtn');
    if (btn) {
      btn.href = BAYAAN.config.joinFormUrl;
      if (BAYAAN.config.joinFormUrl === '#') btn.removeAttribute('target');
    }
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function all() { ticker(); wings(); ventures(); team(); join(); }

  return { all };
})();
