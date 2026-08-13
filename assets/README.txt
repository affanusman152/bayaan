REQUIRED
--------
logo.png    the بیان mark. Black background is fine — js/logo.js keys it out
            at load. A transparent-background export is even better.

            Any resolution or crop works — the mark is only ever placed, never
            traced, so nothing depends on its internal geometry.


WANTED NEXT
-----------
hero.jpg    the full-bleed hero photo. Your general-body / group shot is ideal.

            - LANDSCAPE or square, wide enough to crop tall on mobile
            - at least 1600px on the long edge, ideally 2000px+
            - faces in the upper-middle: the image is cropped with
              `object-position: center 32%` and the bottom ~45% sits under
              a dark scrim that carries the headline
            - it is rendered greyscale then duotoned to maroon/gold, so
              colour balance in the original does not matter much;
              contrast and sharpness do

            Without it the hero shows a designed maroon panel instead
            (not a broken box), so this is safe to add whenever.


OPTIONAL
--------
team/       council portraits, 3:4 crops, ~800x1066
og.jpg      1200x630 social preview (currently points at logo.png)

Team photos: give each member in js/data.js a `photo` key
(e.g. photo: "assets/team/affan.jpg") and swap the <img> inside
`.member__photo` in js/render.js. The maroon curtain-lift animation
already sits on top of it.
