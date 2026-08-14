/* ══════════════════════════════════════════════════════════
   BAYAAN — motion engine
   No libraries. IntersectionObserver + rAF + WAAPI only.
   ══════════════════════════════════════════════════════════ */

const Motion = (() => {

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE  = window.matchMedia('(hover: none)').matches;

  /* ── text splitting ─────────────────────────────── */

  // "Executive Council '26" → block lines that slide up from a mask
  function splitLines(el) {
    if (!el || el.dataset.split) return;
    const words = el.textContent.trim().split(/\s+/);
    // group into 2 visual lines max on mobile, otherwise per-word blocks
    const perLine = words.length > 3 ? Math.ceil(words.length / 2) : words.length;
    const lines = [];
    for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine).join(' '));

    el.innerHTML = lines
      .map((ln, i) => `<span class="ln" style="--li:${i}"><i>${ln}</i></span>`)
      .join('');
    el.dataset.split = '1';
  }

  // Urdu couplet → per-word ink bloom, right to left
  function splitWords(el) {
    if (!el || el.dataset.split) return;
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((w, i) => `<span class="w" style="--wi:${words.length - 1 - i}">${w}</span>`)
      .join(' ');
    el.dataset.split = '1';
  }

  /* ── icon path preparation (self-drawing line art) ── */
  function prepIcons(root = document) {
    root.querySelectorAll('.wing__icon').forEach(svg => {
      [...svg.querySelectorAll('path, circle, line, rect')].forEach((p, i) => {
        let len = 320;
        try { len = Math.ceil(p.getTotalLength()) || 320; } catch (e) { /* line/rect fallbacks */ }
        p.style.setProperty('--l', len);
        p.style.setProperty('--si', i);
      });
    });
  }

  /* ── reveal observer ────────────────────────────── */
  const REVEAL_SEL = '[data-reveal], .wing, .vt, .member, .pillars li, [data-line-reveal], [data-word-reveal], [data-ink-reveal], [data-photo-reveal]';
  let io = null;

  function ensureObserver() {
    if (io) return io;
    io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        activate(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    return io;
  }

  function activate(el) {
    if (el.hasAttribute('data-line-reveal') || el.hasAttribute('data-word-reveal')) {
      el.classList.add('is-in');
    } else if (el.hasAttribute('data-ink-reveal')) {
      el.classList.add('is-written');
    } else {
      el.classList.add('is-in');
    }
  }

  const isActive = el => el.classList.contains('is-in') || el.classList.contains('is-written');

  function inView(el) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    return r.top < innerHeight * 0.92 && r.bottom > 0;
  }

  /* Anything already on screen is revealed directly rather than waiting on the
     observer. An unobserve/observe cycle (which is what a screen revisit does)
     is not guaranteed to redeliver an initial entry, and when it doesn't the
     content stays hidden for good — so the observer handles scrolling only,
     and this pass handles what's already in front of the reader. */
  function sweepVisible(root, obs) {
    root.querySelectorAll(REVEAL_SEL).forEach(el => {
      if (isActive(el) || !inView(el)) return;
      activate(el);
      obs.unobserve(el);
    });
  }

  function observe(root = document) {
    const obs = ensureObserver();
    root.querySelectorAll(REVEAL_SEL).forEach(el => {
      if (el.hasAttribute('data-line-reveal')) splitLines(el);
      if (el.hasAttribute('data-word-reveal')) splitWords(el);
      if (REDUCED) { activate(el); return; }
      obs.observe(el);
    });
    prepIcons(root);
    countersIn(root);

    if (REDUCED) return;
    requestAnimationFrame(() => sweepVisible(root, obs));
    setTimeout(() => sweepVisible(root, obs), 1200);   // belt and braces
  }

  // replay animations when a screen is revisited
  function reset(root) {
    if (!root || REDUCED) return;
    root.querySelectorAll(REVEAL_SEL).forEach(el => {
      el.classList.remove('is-in', 'is-written');
      if (io) io.unobserve(el);
    });
    root.querySelectorAll('[data-count]').forEach(el => { el.dataset.done = ''; });
  }

  /* ── number counters ────────────────────────────── */
  function countersIn(root = document) {
    const els = root.querySelectorAll('[data-count]');
    if (!els.length) return;
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting || e.target.dataset.done) return;
        e.target.dataset.done = '1';
        runCount(e.target);
        cio.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    els.forEach(el => cio.observe(el));
  }

  function runCount(el) {
    const to = parseFloat(el.dataset.count) || 0;
    const sfx = el.dataset.suffix || '';
    if (REDUCED) { el.textContent = to + sfx; return; }
    const dur = 1400, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased) + (p === 1 ? sfx : '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── magnetic buttons ───────────────────────────── */
  function magnetic() {
    if (COARSE || REDUCED) return;
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest?.('[data-magnetic]');
      document.querySelectorAll('[data-magnetic]').forEach(b => {
        if (b !== el) b.style.transform = '';
      });
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }, { passive: true });
  }

  /* ── maroon aura follows pointer, drifts on scroll ── */
  function aura() {
    const el = document.getElementById('aura');
    if (!el || REDUCED) return;
    let x = innerWidth / 2, y = innerHeight * 0.4;
    if (!COARSE) {
      document.addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }, { passive: true });
    } else {
      addEventListener('scroll', () => {
        y = innerHeight * 0.35 + (scrollY * 0.08) % innerHeight;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }, { passive: true });
    }
  }

  /* ── scroll-linked chrome: nib, spine, hiding topbar ── */
  function scrollFX() {
    const nib   = document.getElementById('scrollnib');
    const bar   = document.getElementById('topbar');
    const spine = () => document.getElementById('spineFill');
    let last = 0, ticking = false;

    const frame = () => {
      const y   = scrollY;
      const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const p   = Math.min(y / max, 1);

      nib?.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      bar?.classList.toggle('is-stuck', y > 24);
      bar?.classList.toggle('is-hidden', y > 260 && y > last && !document.body.classList.contains('is-locked'));

      // timeline spine fills with the viewport centre
      const s = spine();
      if (s) {
        const tl = s.closest('.timeline').getBoundingClientRect();
        const fill = Math.min(Math.max((innerHeight * 0.6 - tl.top) / tl.height, 0), 1);
        s.style.setProperty('--fill', (fill * 100).toFixed(1) + '%');
      }

      // parallax layers (centring is handled by the `translate` property in CSS)
      document.querySelectorAll('[data-parallax]').forEach(el => {
        const k = parseFloat(el.dataset.parallax) || 0.1;
        el.style.transform = `translate3d(0, ${(y * k).toFixed(1)}px, 0)`;
      });

      last = y;
      ticking = false;
    };

    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }, { passive: true });
    frame();
  }

  return { REDUCED, COARSE, splitLines, splitWords, observe, reset, magnetic, aura, scrollFX, prepIcons };
})();
