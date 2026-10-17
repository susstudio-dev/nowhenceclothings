# Nowhence design system

Owner: WS-A (`design-system-engineer`). Direction: decision D11, premium minimal-editorial. Brand assets are placeholders (D12).

Source files: `tailwind.config.ts` holds the tokens, `src/app/globals.css` holds the CSS variables and base layer, `src/components/ui/` holds the primitives and `src/components/chrome/` holds the site frame.

## Principles
1. **Paper and ink.** An off-white page, near-black text and one muted accent. There are no gradient fills and no drop shadows.
2. **Type does the work.** A display serif sets headlines and a grotesk sets everything else. Labels are small uppercase text with wide tracking.
3. **Whitespace is the luxury.** Sections are spaced with `py-section`, which is 72px on mobile, 112px on tablet and 144px on desktop.
4. **Imagery is full-bleed.** Product and editorial photography runs edge to edge. Image wells use `paper-deep` while they load.
5. **Motion stays quiet.** Animate only opacity and transform, for 300 ms or less, and respect `prefers-reduced-motion`.
6. **Avoid template tells.** No pill-shaped controls (radius is 0 to 2px), no emoji, no "Shop now!" banners, no badges on everything.

## Colour
Each colour is set on `:root` as space-separated RGB channels, so Tailwind alpha works (for example `bg-ink/30`).

| Token | Value | Use |
|---|---|---|
| `paper` | 248 246 241 | Page background |
| `paper-deep` | 238 235 227 | Image wells, skeletons, announcement bar |
| `ink` | 22 21 19 | Text, primary buttons, focus ring |
| `ink-soft` | 58 56 52 | Secondary text, button hover |
| `muted` | 112 109 102 | Meta text and hints (about 4.9:1 on paper, passes AA) |
| `line` | 222 218 209 | Hairline borders and dividers |
| `accent` | 96 84 64 | Muted umber. The only accent; use it sparingly for editorial highlights |
| `sale` | 146 42 30 | Oxblood, for sale prices and errors |
| `success` | 52 88 60 | Confirmation states |

## Typography
Fonts load through `next/font` in `src/components/chrome/fonts.ts` and are applied to `<html>` in the root layout.
- `font-display` is **Cormorant Garamond** (400/500, with italics). Use it for headlines, the wordmark and pull quotes.
- `font-sans` is **Inter Tight** (400/500). Use it for body text, UI and labels.

The scale steps up by a ratio of 1.25 from a 16px base. Use these tokens and avoid arbitrary sizes.

| Class | Size / leading | Use |
|---|---|---|
| `text-micro` | 11 / 16, tracking 0.14em | Eyebrows, nav, labels, buttons (sm) |
| `text-caption` | 12 / 18 | Captions, buttons (md, lg), legal |
| `text-small` | 14 / 22 | Secondary copy, accordion bodies |
| `text-body` | 16 / 26 | Default |
| `text-lead` | 20 / 30 | Intro paragraphs, large prices |
| `text-h4` … `text-h1` | 25, 31, 39, 49 | Headings (negative tracking) |
| `text-hero` | clamp(48px, 8vw, 104px) | Home and drop heroes only |

Helper classes: `.eyebrow` (micro caps in muted), `.link-underline` (a hairline underline that grows on hover and sets `aria-current`), and `.container-page` (max width 1440px with the responsive gutter).

## Space, layout and radius
- `px-gutter` is 20px, 32px or 48px depending on breakpoint. `py-section` is section rhythm. `h-header` is the header height (60px, or 68px from md up).
- Max widths: `max-w-page` (1440px) and `max-w-prose` (38rem) for long-form text.
- Radius: `rounded` and `rounded-sm` are both 2px. Controls are square by default.
- Z-index: `z-header` (40) and `z-overlay` (50).

## Motion
| Token | Value |
|---|---|
| `duration-fast` / `base` / `slow` | 150 / 220 / 300 ms |
| `ease-out` | cubic-bezier(0.22, 1, 0.36, 1) |
| `ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) |
| `animate-fade-in`, `animate-rise-in`, `animate-slide-in-{left,right,up}` | Entrance animations, 220 to 300 ms |

A global `prefers-reduced-motion` rule shortens every animation and transition to almost nothing.

## Primitives (`@/components/ui`)
Prop signatures are frozen (see `docs/CONTRACTS.md`); only styling and behaviour changed.

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (ink fill), `secondary` (ink outline that fills on hover), `ghost`, `link`. Sizes: `sm` 36px, `md` 48px, `lg` 56px. `loading` keeps the button's width, shows a `Spinner` and sets `aria-busy`. Focus shows a 1px ink outline offset by 3px. |
| `Input`, `Select` | Label sits above the field in micro caps. The field is 48px tall with a hairline border that turns ink on focus. `hint` and `error` are linked with `aria-describedby`; errors use `role="alert"` and a `sale` border. Select is a native element with a hairline chevron. |
| `Drawer` | Rendered in a portal, with `role="dialog"` and `aria-modal`. Traps focus and restores it on close, locks scroll (ref-counted), and closes on Escape or a backdrop click. Slides in with a 300 ms transform and stays mounted until the exit finishes. |
| `Dialog` | Built on native `<dialog>` (top layer). Closes on Escape or a backdrop click, returns focus to the opener, and enters with `rise-in`. |
| `Accordion` | Native `<details>`, so it works without JS. A plus icon rotates into a close icon. |
| `Price` | Tabular figures. On sale it shows the `sale` colour plus the struck-through original, with screen-reader text ("Sale price … , was …"). |
| `Image` | `<picture>` with AVIF and WebP R2 variants, a `paper-deep` placeholder, and intrinsic dimensions so the layout doesn't shift. |
| `Spinner`, `Wordmark`, `Icon*` | Hairline icons (`IconClose`, `IconMenu`, `IconSearch`, `IconBag`, `IconPlus`, `IconMinus`, `IconChevronDown`, `IconArrowRight`, `IconUser`) are `aria-hidden`. Label the control that contains them. |
| `useFocusTrap`, `useScrollLock` | Exported for other custom overlays (for example the search overlay). |

## Chrome (`@/components/chrome`)
These are presentational. The storefront layout `(shop)/layout.tsx` (WS-B) supplies the data from `getSiteContent()` and `getSettings()`.

```tsx
<AnnouncementBar announcement={content.announcement} />
<Header nav={content.nav.primary} cartSlot={<CartButton />} /> {/* or cartCount={n} */}
<main id="main">{children}</main>
<Footer columns={content.nav.footer} email={settings.store.email} newsletter={<NewsletterForm />} />
```

- **Header** (client component): sticky, translucent paper, and a hairline that appears once the page scrolls. Desktop has the nav on the left, the wordmark in the centre, and search and bag on the right. Below `lg` a menu button opens `MobileNav`. It includes the skip link to `#main`. The bag link has an accessible count; WS-C can replace it through `cartSlot`.
- **MobileNav**: a left `Drawer` with top-level links in the display serif, staggered `rise-in`, and child links listed underneath.
- **AnnouncementBar** (server component): one line of micro caps on `paper-deep`. It renders nothing when disabled.
- **Footer** (server component): a statement line, a newsletter slot, link columns, an oversized wordmark and small print.

## Rules for other workstreams
- Use tokens and don't hard-code hex values. If a new token is needed, ask WS-A or add it without renaming existing ones.
- Every interactive element needs a visible `focus-visible` state and a minimum 40px touch target.
- Image `alt` text is required. Decorative images use `alt=""`.
- Use one primary button per view. Everything else is secondary, ghost or link.
