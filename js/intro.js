/* ══════════════════════════════════════════════════════════
   INTRO

   Deliberately not its own animation. It drives the very same
   #curtain element and the same `is-in` / `is-out` classes the
   router uses between screens, so the way the site opens and the
   way it moves are one gesture — and they can never drift apart,
   because there is only one implementation to change.

     panels wipe up  →  بیان seal holds  →  panels wipe away
   ══════════════════════════════════════════════════════════ */

const Intro = (() => {
  const curtain = document.getElementById('curtain');
  const mark    = document.getElementById('brandMark');
  let done = false;

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;            // force reflow so the animation replays
    el.classList.add(cls);
  }

  function reveal() {
    document.body.classList.remove('is-booting');
    mark?.classList.add('is-in');
  }

  function finish() {
    if (done) return;
    done = true;
    reveal();
    document.dispatchEvent(new CustomEvent('bayaan:ready'));
  }

  async function run() {
    if (!curtain || Motion.REDUCED) { finish(); return; }

    restart(curtain, 'is-in');
    await wait(820);                // panels closed, the seal reads

    reveal();                       // stage fades in behind the curtain
    curtain.classList.remove('is-in');
    restart(curtain, 'is-out');

    await wait(600);
    curtain.classList.remove('is-out');
    finish();
  }

  return { init: run, finish };
})();
