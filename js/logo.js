/* ══════════════════════════════════════════════════════════
   THE MARK — load, inspect, place

   The current artwork already carries a real alpha channel, so
   it is used exactly as supplied: no keying, no blend tricks.

   A logo exported on a solid BLACK background still works — that
   art is effectively pre-screened against black, so alpha =
   max(r,g,b) plus an un-premultiply restores it to a clean cutout.
   We only take that path when the file has no transparency of its
   own, and never when it would damage what's already there.

   Reading pixels needs a same-origin canvas; opening index.html
   straight off the disk blocks it. In that case a black-background
   file falls back to `mix-blend-mode: screen`. A transparent file
   (like ours) needs neither and looks right either way.
   ══════════════════════════════════════════════════════════ */

const Logo = (() => {
  let src = BAYAAN.config.logo;
  let keyed = false;
  let hasAlpha = false;

  /* ── does the file already carry transparency? ── */
  function inspect(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);   // throws if tainted

    let clear = 0;
    for (let i = 3; i < d.data.length; i += 4 * 37) {      // sparse sample, plenty
      if (d.data[i] < 250) clear++;
    }
    return { ctx, d, transparent: clear > (d.data.length / (4 * 37)) * 0.02 };
  }

  /* ── drop a solid black background (only when there's no alpha) ── */
  function keyOut(ctx, d) {
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const a = Math.max(p[i], p[i + 1], p[i + 2]);
      if (a < 12) { p[i + 3] = 0; continue; }              // black → gone
      const k = 255 / a;                                    // un-premultiply
      p[i]     = Math.min(255, p[i]     * k);
      p[i + 1] = Math.min(255, p[i + 1] * k);
      p[i + 2] = Math.min(255, p[i + 2] * k);
      p[i + 3] = a;
    }
    ctx.putImageData(d, 0, 0);
    return ctx.canvas.toDataURL('image/png');
  }

  /* ── point every placement at the final source ── */
  function apply() {
    document.querySelectorAll('img.logo-img').forEach(el => { el.src = src; });
    document.querySelectorAll('image.logo-img').forEach(el => {
      el.setAttribute('href', src);
      el.setAttribute('xlink:href', src);
    });
    const icon = document.querySelector('link[rel="icon"]');
    if (icon && keyed) icon.href = src;
  }

  function init() {
    return new Promise(resolve => {

      const ready = (probe) => {
        document.body.classList.add('has-logo');
        let mode = 'as supplied (blend-mode fallback)';
        try {
          const { ctx, d, transparent } = inspect(probe);
          hasAlpha = transparent;
          if (transparent) {
            document.body.classList.add('logo-alpha');   // already a clean cutout — leave it alone
            mode = 'transparent, used untouched';
          } else {
            src = keyOut(ctx, d);
            keyed = true;
            document.body.classList.add('logo-keyed');
            mode = 'opaque background keyed out';
          }
        } catch (e) {
          // canvas reads are blocked on file:// — harmless for a transparent file
        }
        apply();
        console.info('[bayaan] logo ✓ %d×%d — %s', probe.naturalWidth, probe.naturalHeight, mode);
        resolve(true);
      };

      // NOTE: no crossOrigin here. It is unnecessary for a same-origin image and
      // makes the load fail outright on file:// pages, which silently drops the
      // whole site back to the vector stand-in.
      const load = () => new Promise((ok, fail) => {
        const probe = new Image();
        probe.onload  = () => ok(probe);
        probe.onerror = fail;
        probe.src = BAYAAN.config.logo;
        if (probe.complete && probe.naturalWidth) ok(probe);
      });

      load()
        .then(ready)
        .catch(() => {
          document.body.classList.add('no-logo');
          console.warn('[bayaan] %s could not be loaded — showing the vector stand-in. ' +
                       'Check the file exists and that you are on http://localhost (node serve.js).',
                       BAYAAN.config.logo);
          resolve(false);
        });
    });
  }

  return { init, get src() { return src; }, get keyed() { return keyed; }, get hasAlpha() { return hasAlpha; } };
})();
