/* ══════════════════════════════════════════════════════════
   ROUTER — hash routes with an ink-curtain transition
   #/home  #/about  #/wings  #/ventures  #/team  #/join
   ══════════════════════════════════════════════════════════ */

const Router = (() => {
  const ROUTES = ['home', 'about', 'wings', 'ventures', 'team', 'join'];
  const curtain = document.getElementById('curtain');
  const stage   = document.getElementById('stage');

  let current = null;
  let busy = false;
  let pending = null;

  const screenOf = r => document.getElementById(`screen-${r}`);
  const parse = () => {
    const r = (location.hash || '').replace(/^#\/?/, '').trim();
    return ROUTES.includes(r) ? r : 'home';
  };

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;          // force reflow so the animation replays
    el.classList.add(cls);
  }

  function paint(route) {
    ROUTES.forEach(r => {
      const s = screenOf(r);
      if (!s) return;
      s.hidden = r !== route;
      s.classList.remove('is-leaving', 'is-entering');
    });
    const now = screenOf(route);
    Motion.reset(now);
    document.documentElement.scrollTop = document.body.scrollTop = 0;
    restart(now, 'is-entering');
    // observers hook up after the screen is laid out
    requestAnimationFrame(() => Motion.observe(now));
    Drawer.markActive(route);
    document.title = route === 'home'
      ? "Bayaan — FAST NUCES Multan"
      : `${route[0].toUpperCase() + route.slice(1)} · Bayaan`;
    current = route;
  }

  async function go(route, { instant = false } = {}) {
    if (route === current) return;
    // a nav fired mid-wipe isn't dropped — it runs as soon as the stage is clear
    if (busy) { pending = route; return; }
    if (instant || Motion.REDUCED) { paint(route); return; }

    busy = true;
    const leaving = current ? screenOf(current) : null;
    leaving?.classList.add('is-leaving');

    curtain.classList.remove('is-out');
    restart(curtain, 'is-in');

    await wait(660);
    paint(route);

    curtain.classList.remove('is-in');
    restart(curtain, 'is-out');

    await wait(560);
    curtain.classList.remove('is-out');
    busy = false;

    if (pending) { const next = pending; pending = null; go(next); }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function init() {
    // intercept every in-app link
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-link]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#/')) return;
      e.preventDefault();
      const route = href.replace('#/', '');
      if (route === current) { Drawer.close(); return; }

      if (Drawer.isOpen) {
        Drawer.close();
        setTimeout(() => { location.hash = href; }, 260);
      } else {
        location.hash = href;
      }
    });

    addEventListener('hashchange', () => go(parse()));

    // keyboard: ← → walk the screens
    addEventListener('keydown', (e) => {
      if (Drawer.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = ROUTES.indexOf(current);
      if (e.key === 'ArrowRight' && i < ROUTES.length - 1) location.hash = `#/${ROUTES[i + 1]}`;
      if (e.key === 'ArrowLeft'  && i > 0)                  location.hash = `#/${ROUTES[i - 1]}`;
    });
  }

  return { init, go, parse, get current() { return current; } };
})();
