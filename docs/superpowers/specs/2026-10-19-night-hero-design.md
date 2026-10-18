# Home hero: "eyes in the dark" (night hero)

Approved prototype: https://claude.ai/artifact/VJLYXNAZ1WSdcwXkKaWdq1 (concept board: https://claude.ai/artifact/4fuN7tCH9wZiCWH6gyv3xM, direction A, revised).
Replaces the drawn stitch hero for the Panther Polo. The drawn polo read as an illustration, not as fabric.

## The idea
A black panther is a leopard: its rosettes are still there and show only in the right light. The polo works the same way, with black thread on black piqué. The hero opens dark on the real cloth. Two panther eyes watch the visitor's light, the rosettes stitch themselves into the cloth, and then the room light comes up on the finished embroidery.

## What it does
- **Ground.** The real macro photograph of the Panther Polo, rendered by a Three.js fragment shader. Nothing on the cloth is drawn.
- **Stitching.** Three textures from the same crop: `full` (embroidered), `bare` (the thread removed and filled with neighbouring piqué), and `order` (per thread pixel, a 16-bit time at which that pixel is sewn, in R and G; B marks thread). As progress runs 0 → 1, each pixel switches from `bare` to `full` once its time has passed. Each rosette is traced around its own ring from a random start angle. Rosettes follow the pattern's flow from the collar (top right) downward and overlap in time. A warm glint marks the newest thread, where the needle is.
- **Light.** One soft torch (a Gaussian, aspect-correct) plus a wider raking falloff, an ambient term, a vignette and very light grain. The torch follows the pointer (eased), follows a drag on touch, and drifts on a slow Lissajous path when the pointer has been idle for over 2.2 s.
- **Eyes.** A pair of panther eyes, screen-blended over the cloth, with pupils that follow the torch. They ship as the drawn SVG from the prototype. When the owner supplies the panther photo, a crop of its eyes (`eyes.webp`, on black) replaces the SVG without any code change other than the asset entry.

## Sequence (anime.js timeline; 11 s on desktop, 8 s under 768px, same beats scaled)
| Beat | Desktop | What moves |
|---|---|---|
| Dark | 0–1.5 s | Cloth at ambient 0.04. The eyes fade in and the lids open. |
| Light | 1.4–2.8 s | The torch radius and strength come up. |
| Stitch | 3.0–9.6 s | Progress 0 → 1 (`easeInOutQuad`). |
| Reveal | 9.4–11 s | The eyes blink, then fade. Ambient rises to 0.62 and the torch widens into a raking light. |

After the timeline ends, the stage stays interactive: the torch keeps following the pointer over the finished, lit cloth.

## Copy and action
Copy is server-rendered and readable from the first frame. It is not faded in by the timeline: an 11 s wait in front of the reserve button costs pre-orders.
- h1: "Every black panther has spots. You only see them in the light." Per-motif copy lives with the assets (below).
- Under it: product name, colour, price (`formatPaise`, hidden when `priceHidden`), then the pre-order care tag and `QuickReserveButton` (pre-order) or "View the polo" link, exactly as `StitchHero` does today.
- The site-content hero heading ("Five animals. One polo.") is shown as a small tagline under the h1, so it stays editable in admin and is not repeated below.
- A left-to-right ink scrim (bottom-up on phones) keeps the copy legible over lit rosettes.

## Which hero leads
`page.tsx` keeps choosing the lead product with `pickStitchProduct`/`motifFor`. If that product's motif has night-hero assets (`nightHeroFor(motif)` returns an entry), `NightHero` leads; otherwise `StitchHero` leads, so the other four animals keep the current hero until their photos are prepared. Today only `rings` (panther) has assets.

## Plays once, and fallbacks
- First visit in a browser session: the full sequence (`sessionStorage`, guarded in try/catch).
- Later visits in the session: the stage starts at the end state, lit and interactive, with no eyes.
- On a first visit the lit poster dims into the dark opening as the canvas fades in (700 ms). This is intended: the lights go out, then the eyes open.
- `prefers-reduced-motion`, no WebGL, or a script failure: a server-rendered `<picture>` poster of the lit embroidered crop (`full`), the same image the canvas covers. It is also the LCP element and the paint before Three.js loads; the canvas fades in over it only once all three textures have loaded.
- Off screen (IntersectionObserver) the render loop stops. Hidden tabs pause naturally (rAF).

## Crops and assets
- Two crops from the 1600 × 2000 source (`public/media/seed-02771980b22260fb/1600.webp`): **wide** 1600 × 900 (y 380–1280) for ≥ 768px, and **tall** 1280 × 1600 (4:5, x 320–1600, y 300–1900, clear of the grey wall) for phones. Each crop has `full.webp`, `bare.webp` and `order.png`.
- Files live in `public/hero/rings/{wide,tall}/`. In total, about 0.8 MB per breakpoint; a device loads only one breakpoint.
- `scripts/prep-night-hero.mjs` (Node + `sharp`, a dev dependency) generates them from the source photo: thread mask by local contrast, connected components filtered by size, aspect and distance from the wall, removal mask dilated to include the thread's shadow halo, bare cloth filled by offset copies of nearby piqué and feathered, then the order map. This ports the prototype's Python prep. The script is run by hand and its output committed; it is not part of the build.
- A dedicated shoot of a blank polo in the same light would make `bare` exact. With the generated `bare`, faint ghosts can show under the torch. Swapping in better source photos means only re-running the script.

## Units
- `src/lib/night-hero.ts` (pure, tested in `night-hero.test.ts`): the per-motif registry (`nightHeroFor(motif)` → asset paths per crop, copy lines, eye anchor, `eyes` image or none); `coverScale(stageAspect, imageAspect)` for the shader's cover fit; `driftAt(seconds)` for the idle torch path; `timelineFor(width)` giving beat offsets and durations, with the phone timeline scaled from the desktop one; `decodeOrder(r, g)` matching the shader's decoding.
- `src/lib/night-hero-shader.ts`: the vertex and fragment shader strings (from the prototype) and the uniform names.
- `src/components/shop/NightStage.tsx` (client): dynamically imports `three` and `animejs` after mount; builds the renderer, plane and `ShaderMaterial`; loads the textures for the active crop; runs one rAF loop that copies timeline state into the uniforms every frame (anime's `update` callback does not fire on seek); handles the torch, the eyes, session play-once and visibility. It renders the eyes SVG and the canvas, and nothing else.
- `src/components/shop/NightHero.tsx` (server): the section (`data-chrome-hero`, the default dark-hero header state: transparent, paper type), the poster `<picture>`, the copy, the action and `<NightStage>`.
- `src/app/(shop)/page.tsx`: picks `NightHero` over `StitchHero` as described above.
- Dependencies: `three` and `@types/three`, `animejs` (v4, ESM, built-in types); `sharp` as a dev dependency.
- `docs/DESIGN.md`: a "Home hero: eyes in the dark" section replacing the stitch section for the panther, linking this spec. `docs/DECISIONS.md`: one entry (real photograph + shader over a drawn polo; Three.js and anime.js loaded only on the home page).

## Performance budget
- Three.js and anime.js are imported dynamically from `NightStage`, so they are not in the shared bundle and are loaded only on the home page. Import only the three classes used, so tree-shaking applies.
- Pixel ratio capped at 2 (1.5 under 768px). Textures without mipmaps; the order texture uses nearest filtering.
- LCP is the poster image, not the canvas.

## Testing
- `night-hero.test.ts`: registry (rings has assets, other motifs return none), cover fit for wider and narrower stages, phone timeline proportional to the desktop one and ending at 8 s, `decodeOrder` round trip (0, 1 and mid values), and the drift staying inside the stage.
- Manual: prototype parity at desktop and phone widths; reduced motion shows only the poster; a second visit in the same session starts lit; the header reads correctly over the dark stage; and the reserve sheet opens from the hero.
- Done = `npm run typecheck && npm test` green, plus `npm run build`.

## Out of scope
Night-hero assets for the other four animals, a real panther-photo eyes crop (slot ready, waiting on the photo), an admin toggle, sound.
