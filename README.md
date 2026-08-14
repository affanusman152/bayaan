# Bayaan — motion scaffold

Literary & public speaking society · FAST NUCES Multan Campus.
Mobile-first, zero dependencies, zero build step.

```
node serve.js     →  http://localhost:5173     (recommended)
```
Opening `index.html` directly works too — see the note under **The logo** for the one
difference.

---

## ⚠️ First thing: drop the logo in

Save the بیان artwork as **`assets/logo.png`**. Everything else is already wired to it —
splash, header, curtain seal, drawer watermark, hero wordmark, join seal, team card
placeholders and the favicon. Until the file exists, the site runs on a hand-vectored
stand-in and logs a note to the console.

### The logo, handled properly
The artwork you have sits on a **solid black background**, which looks fine on the dark
screens and like a black box over the maroon glow. So `js/logo.js` **keys the black out at
load**: the art is already effectively screened against black, so alpha is `max(r,g,b)` and
an un-premultiply restores true colour — a clean cutout with the antialiasing intact. No
manual editing needed.

That keying reads pixels off a canvas, which browsers block on `file://` origins. So:

| How you open it | What happens |
|---|---|
| `node serve.js` (or any http server) | Black is keyed out — clean transparent mark everywhere ✅ |
| double-clicking `index.html` | Falls back to `mix-blend-mode: screen` — good on dark areas, can show a faint box over the maroon glow |
| you supply a **transparent PNG** | Best of all; nothing to key, works either way |

If you have a transparent-background export, use that and ignore all of the above.

---

## The motion idea

Bayaan's identity is a *stroke* — the qalam sweep under بیان, the mic, the brush.
So nothing on this site fades in generically. Everything **draws, bleeds, wipes or settles**,
the way ink behaves. Three rules the whole scaffold obeys:

1. **Urdu always reveals right-to-left.** It's written, not animated onto the screen.
2. **Gold is light, maroon is mass.** Gold shimmers and travels; maroon slides and blocks.
3. **One easing does the personality.** `--e-ink` (a long settle) is on ~80% of moves.

---

## Animation catalogue — what's actually in here

| # | Where | What happens |
|---|-------|--------------|
| 01 | **Intro** | The **same curtain as the page transitions**, deliberately. Four maroon panels wipe up in a stagger, the بیان seal holds at centre, then they wipe away. Not a separate animation: `js/intro.js` drives the router's own `#curtain` element and its `is-in` / `is-out` classes, so the way the site opens and the way it moves are one gesture and cannot drift apart. |
| 02 | **Intro → site** | The header mark springs in as the panels clear; the stage fades up behind them. |
| 03 | **Hero** | **Two layouts, split at 1024px.** Desktop is the full-bleed overlay: the photo bleeds behind the whole type block, greyscaled then **duotoned** to maroon shadows / gold highlights via blend layers, with a maroon ink curtain lifting off it on load and a slow 14s ken-burns push-in. Below 1024px it becomes two zones instead — headline up top, photo as a **stage band** across the foot, the society standing under the title. Headline splits into masked lines that slide up. Falls back to a designed maroon panel when no photo is present. |
| 04 | **Hero couplet** | Per-word bloom — each word rises out of a blur, sequenced **right to left** so it reads as it appears. |
| 05 | **Screen transitions** | The same four-panel curtain as the intro. Outgoing screen scales + blurs out; incoming rises out of the wipe. |
| 06 | **Drawer** | Headed **Contents / فہرست**. Slides on `--e-glide`, items stagger in from the right, each row reveals its Urdu name and a gold underline on hover. Burger morphs to an X. Urdu watermark drifts behind it. Swipe-right closes; edge-swipe from the right rim opens. Foot carries two chips — an outlined **Instagram** with its glyph, and **Register** in the same gold as the hero CTA. |
| 07 | **Page titles** | Split into masked lines that slide up with a slight rotation. |
| 08 | **Wings** | An **index, not a rail**. A full-bleed band of the induction night opens the screen and names the umbrella, then the six wings are listed under the two halves the society is actually named after — *Public Speaking* and *Literary*. Each row sweeps a maroon wash in from the left on hover, grows the gold spine borrowed from the pillars, and its line-icon **draws itself** (`stroke-dashoffset`) when it scrolls in. |
| 09 | **Ventures** | Vertical timeline whose gold spine **fills as you scroll**; each node lights up and rings when its entry enters view. **Harf se Harf Tak** — the society's main event — is lifted out of the plain list into a bordered flagship card with a gold badge and its Urdu title. |
| 10 | **Team** | Poster-style cards where a maroon curtain **lifts off each portrait**, staggered — the same feel as your council posters. |
| 11 | **Stats** | Count up from zero on first view. |
| 12 | **Ambience** | Film grain, vignette, a maroon aura that tracks the pointer (drifts on scroll for touch), a gold scroll-progress nib on the right edge, hiding-on-scroll top bar, magnetic buttons on pointer devices, and a paused-on-hover couplet ticker. There is **no scroll-down hint** at the foot of the hero — it was removed. |
| 13 | **Join** | Breathing wax seal, staggered steps, gold CTA with a cream fill that rises from the bottom. |
| 14 | **Group frame** (About) | The same group photograph as the hero, but shown **uncropped and untinted** — the hero band crops to the faces, this is the whole picture in true colour. Gold poster corner-ticks frame it, and the hero's own `inkLift` curtain wipes off it when it scrolls in. |

Everything degrades correctly under `prefers-reduced-motion: reduce` — reveals fire instantly
and the curtain is skipped entirely, intro included.

**A known trade, chosen on purpose.** On desktop the type sits over the photograph, so on
viewports narrower than roughly 1800px the headline crosses the back row's faces. That is
accepted for the full-bleed drama on a large screen. It is *not* accepted on phones — a 3:2
group shot under `object-fit: cover` in a portrait viewport keeps only about the middle
third, which is why the stage-band layout takes over below 1024px. If you ever want the
band on desktop too, delete the `.hero` overrides in the `min-width: 1024px` block of
`css/screens.css`; the band is the default and needs nothing else.

**A rule the scaffold follows:** no decorative animation is allowed to be the thing that makes
content visible. Every reveal has an *open* resting state and animates from an explicit `from`
keyframe, so a reveal that fails to fire costs the animation and never the content.

---

## Where to put your content

Everything renders from **`js/data.js`**. Nothing else needs touching for content.

| Want to change | Edit |
|---|---|
| Registration form link | `BAYAAN.config.joinFormUrl` |
| Ticker couplets | `BAYAAN.ticker` |
| Wings (name / Urdu / blurb / tags / icon) | `BAYAAN.wings` — each wing's `family` (`"speaking"` or `"literary"`) decides which half it lists under. A wing with no `family` still renders; it falls into the last group rather than vanishing |
| Ventures — **add freely, the list is meant to grow** | `BAYAAN.ventures` — set `flagship: true` on one to pull it out as the main-event card, and `ur` for its Urdu title |
| Induction photo (the wings band) | `assets/induction.jpg`, referenced directly in `index.html` |
| Council members + section bands | `BAYAAN.team` |
| Logo path | `BAYAAN.config.logo` |
| Hero photo | `BAYAAN.config.heroPhoto` — the file lives at `assets/hero.jpg` ✅ *installed* |
| The About group frame | it points at `assets/hero.jpg` directly, in `index.html` — replace the file and both it and the hero follow |
| Intro hold | `BAYAAN.config.introMs` |
| Society prose, pillars, join steps | directly in `index.html` |

> ⚠️ Council names in `data.js` were transcribed off the poster image — **verify the spellings** before this goes live.

### Colours
All in `css/tokens.css`. Change `--maroon`, `--gold`, `--cream` and the entire site follows —
the gradients, glows and shadows are all derived from those three.

### Re-exporting the logo
Any size or crop is fine. The mark is only ever *placed*, never traced, so nothing depends on
its internal geometry.

---

## Structure

```
index.html          all six screens, in order
serve.js            `node serve.js` — tiny static server, no deps
css/tokens.css      colour · type · spacing · easing curves
css/base.css        reset + grain/vignette/aura ambience
css/logo.css        every placement of the mark, in one file
css/ui.css          top bar · drawer · curtain · buttons · ticker
css/screens.css     hero · about · wings · ventures · team · join  (+ the ≥720px pass)
css/motion.css      reveal utilities + screen enter/exit
js/data.js          ← content lives here
js/logo.js          loads the mark, keys out the black, fits it to the mask
js/motion.js        reveal engine, counters, parallax, magnetics, rail dots
js/render.js        data → DOM
js/drawer.js        drawer + focus trap + swipe gestures
js/router.js        hash routing + the curtain transition
js/intro.js         the intro — reuses the router's curtain
js/app.js           boot order
```

Routes: `#/home` `#/about` `#/wings` `#/ventures` `#/team` `#/join` — deep-linkable,
back button works, and ← / → arrow keys walk between screens.

## Deploying
It's a static site. Drag the folder onto Netlify, or push to GitHub and turn on Pages.
