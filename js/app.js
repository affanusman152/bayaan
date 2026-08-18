/* ══════════════ BOOT ══════════════ */

(async function boot() {

  // 0 — settle the mark first: every placement below depends on knowing
  //     whether we have the real artwork or the stand-in
  await Logo.init();

  // 0b — hero photo is optional; the stage has a designed fallback without it
  const shot = new Image();
  shot.onload  = () => document.body.classList.add('has-hero');
  shot.onerror = () => console.info('[bayaan] %s not found — hero is using the maroon panel. ' +
                                    'Drop a wide group shot in to switch it on.', BAYAAN.config.heroPhoto);
  shot.src = BAYAAN.config.heroPhoto;

  // 1 — content into the DOM before anything observes it
  Render.all();

  // 1b — the registration form (no-ops unless Supabase is configured)
  Join.init();

  // 2 — chrome
  Drawer.init();
  Router.init();

  // 3 — ambient motion
  Motion.magnetic();
  Motion.aura();
  Motion.scrollFX();

  // 4 — land on the requested screen without a curtain on first paint
  Router.go(Router.parse(), { instant: true });

  // 5 — the intro runs last so the stage behind it is already built
  Intro.init();

  // the home screen replays its reveals once the curtain clears
  document.addEventListener('bayaan:ready', () => {
    const home = document.getElementById('screen-home');
    if (home && !home.hidden) {
      Motion.reset(home);
      requestAnimationFrame(() => Motion.observe(home));
    }
  });
})();
