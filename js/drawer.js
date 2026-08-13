/* ══════════════ SIDE DRAWER ══════════════ */

const Drawer = (() => {
  const drawer = document.getElementById('drawer');
  const scrim  = document.getElementById('scrim');
  const burger = document.getElementById('burger');
  const closeB = document.getElementById('drawerClose');
  let open = false;
  let lastFocus = null;

  function setOpen(next) {
    if (next === open) return;
    open = next;

    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);

    if (open) {
      lastFocus = document.activeElement;
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add('is-on'));
      // menu items replay their stagger every time
      drawer.querySelectorAll('.drawer__list li').forEach(li => {
        li.style.animation = 'none';
        void li.offsetWidth;
        li.style.animation = '';
      });
      setTimeout(() => drawer.querySelector('.drawer__list a')?.focus({ preventScroll: true }), 340);
    } else {
      scrim.classList.remove('is-on');
      setTimeout(() => { if (!open) scrim.hidden = true; }, 500);
      lastFocus?.focus?.({ preventScroll: true });
    }
  }

  function markActive(route) {
    drawer.querySelectorAll('.drawer__list a').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === `#/${route}`);
    });
  }

  function init() {
    burger.addEventListener('click', () => setOpen(!open));
    closeB.addEventListener('click', () => setOpen(false));
    scrim.addEventListener('click', () => setOpen(false));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
      // focus trap
      if (e.key === 'Tab' && open) {
        const f = [...drawer.querySelectorAll('a, button')].filter(el => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // swipe-right to close (mobile first, remember)
    let sx = 0, sy = 0;
    drawer.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    drawer.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (dx > 70 && dy < 60) setOpen(false);
    }, { passive: true });

    // edge-swipe left from the right rim to open
    addEventListener('touchstart', e => {
      if (open) return;
      const t = e.touches[0];
      if (t.clientX > innerWidth - 24) { sx = t.clientX; sy = t.clientY; drawer.dataset.edge = '1'; }
    }, { passive: true });
    addEventListener('touchend', e => {
      if (drawer.dataset.edge !== '1') return;
      drawer.dataset.edge = '';
      const dx = e.changedTouches[0].clientX - sx;
      if (dx < -60) setOpen(true);
    }, { passive: true });
  }

  return { init, close: () => setOpen(false), markActive, get isOpen() { return open; } };
})();
