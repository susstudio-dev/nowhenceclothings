# Home hero: "the stitch" (Thread first)

Approved concept: https://claude.ai/artifact/4bjhHpzmGGwrctaerFv7n7 (direction "Thread first").

## What it does
The home page opens on a drawn polo that makes itself. The camera starts close on the cloth and the needle stitches that polo's tonal embroidery in satin stitch. Then the camera pulls back, the cut pieces glide in around the embroidered panel, the seams and buttons are sewn, and it rests on the finished polo. Title, price and the one action sit beside it (below it on phones).

## Which polo leads
- An open pre-order piece always leads (as today). If its slug or title names a known motif, it leads as the stitch hero; otherwise the existing photo `PresaleHero` leads.
- With no open pre-order, the first storefront product with a known motif leads.
- If no product has a motif, the page is unchanged (the site-content hero block leads).
- When the stitch hero leads, the site-content hero heading moves to `HomeEditorial` below, as it already does for pre-orders.

Motifs, matched by word in slug or title: `ring` → rings, `wing` → wing (on the left sleeve), `rain` → rain, `pebble` → pebbles, `diamond` → diamonds.

## Colour
The cloth tones (highlight, shade, thread, seam) are derived from the product colour's `hex`, light and dark cloth handled separately. The ground is the brand theme's `paper-deep` (revised 2026-10-18; first version used backdrops sampled from the photographs). A loupe on the left magnifies the embroidery (revised 2026-10-18). Type over the hero is ink. The header uses a new additive `data-chrome-hero="light"` state: transparent, ink type, no shade.

## Motion
- 10 s on desktop, 7 s under 768px. One rAF loop; attribute writes only, no React state per frame. Time accumulates frame to frame (capped), so a hidden tab resumes where it was.
- Plays once per browser session (`sessionStorage`, guarded); later visits and `prefers-reduced-motion` show the finished polo with no needle.
- The SVG is decorative (`aria-hidden`); the caption is server-rendered and readable from the first frame. The stage is drawn client-side, so it adds no HTML weight.

## Units
- `src/lib/stitch-hero.ts`: pure. Motif choice, palette, geometry (path sampling, satin zigzag, motif generators), timeline scheduling, camera. Tested in `stitch-hero.test.ts`.
- `src/components/shop/StitchStage.tsx` (client): builds the SVG from the scene and runs the loop.
- `src/components/shop/StitchHero.tsx`: section, caption and action; pre-order uses `QuickReserveButton`, otherwise a link to the product.
- `src/app/(shop)/page.tsx`: picks the lead.
- `globals.css`: the light-hero header state. `docs/DESIGN.md`: a section on the stitch hero.

## Out of scope
An admin toggle or motif picker, swatches to switch polos in the hero, and a cross-fade to the photograph.
