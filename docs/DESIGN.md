# Nowhence design system

Owner: WS-A (`design-system-engineer`). Decisions D11, D12, A12, A17.
Tokens live in `tailwind.config.ts` and `src/app/globals.css`. Primitives are in `src/components/ui/` and the site frame is in `src/components/chrome/`.

## Direction: "the care label"
Nowhence sells tonal, embossed polos: the pattern shows only up close. The interface should work the same way, quiet at a glance and precise up close. The references are the restraint of Aesop, COS, Lemaire and Our Legacy, not a theme template.

- **The photography carries the colour.** The UI stays monochrome (chalk paper and near-black ink), plus one warm earth neutral, **clay**, sampled from the backdrops.
- **One signature detail: the care label.** Status chips, badges and small labels are tracked micro caps in a 1px hairline box, like the woven label inside a collar. This is the only ornament. Do not invent others.
- **The type is small and confident.** Display type is light and large only where an editorial moment calls for it. Everything else is 11–16px. A small wordmark signals more confidence than a big one.
- **Hairlines, not boxes.** Use 1px `line` rules to divide content. No shadows, no gradients, and a radius of 0 (circles only for swatches).

## Colour
Each token is RGB channels on `:root`, so alpha works (`bg-ink/30`). Settings → Brand overrides `ink`, `paper` and `accent` and derives `ink-soft`, `muted`, `line` and `paper-deep` from them (`lib/brand.ts`). `clay` is not overridden.

| Token | Default | Use |
|---|---|---|
| `paper` | #F4F4F2 | Page |
| `paper-deep` | #EAE9E5 | Image wells, skeletons, hover fills |
| `ink` | #0B0B0B | Text, primary button, focus ring |
| `ink-soft` | #343432 | Secondary text, primary hover |
| `muted` | #6B6B67 | Meta text (4.9:1 on paper) |
| `line` | #DEDDD8 | Hairlines and field borders |
| `accent` | #6B6B67 | Owner's accent (quiet grey by default) |
| `clay` | #A8927A | Warm earth: low-stock notes, success dot, the header status dot, footer symbol. Never body text. |
| `clay-soft` | #E6DFD5 | Clay wash for solid badges and selected tints |
| `sale` | #922A1E | Oxblood: sale price, errors |
| `success` | #34583C | Confirmation |

## Typography
- **Display: Jost** (300/400/500). Headings default to **300 (light)**. Use 400 for small display text (product names in the PDP title). Do not set long passages in Jost.
- **Body/UI: Inter Tight** (400/500). Body text is 14px on mobile and 16px on desktop.
- Both can be swapped from Settings → Brand (`--font-display` / `--font-sans`).

| Token | Size / leading / tracking | Use |
|---|---|---|
| `text-label` | 11 / 16 / 0.18em, uppercase | Nav, buttons, field labels, eyebrows |
| `text-micro` | 11 / 16 / 0.14em | Legacy alias of label |
| `text-caption` | 12 / 18 | Legal, hints, meta |
| `text-small` | 14 / 22 | Body (mobile), card names, footer links |
| `text-body` | 16 / 26 | Body (desktop), inputs (16px prevents iOS zoom) |
| `text-lead` | 20 / 30 | Short intros |
| `text-h4`…`text-h1` | 25 → 49 | Section and page titles |
| `text-display-sm` | clamp 28→40 | Section openers |
| `text-display` / `text-hero` | clamp 36→64 / 44→92 | One per page at most |

Rules: tracked caps only at 10–11px. Never letterspace lowercase. Headlines use `text-wrap: balance`. Use tabular figures for prices and counters. The wordmark is 12px tall on mobile and 15px on desktop in the header, and 10px in the footer.

## Space, grid and rhythm
- 4px base. Component padding steps are 8, 12, 16, 24 and 32. Section padding is `py-section` (64 / 96 / 128px).
- Gutter (`px-gutter`) is 16 / 32 / 40px. The page is `container-page` (max 1440px).
- Grid: 4 columns on mobile and 12 on desktop. Product grids are 2-up on mobile (gap 12px, 8px on 2+ rows) and 4-up on desktop (gap 16–24px). The PDP is a 7/5 split, with the buy column sticky.
- Header is 56 / 64px. There is no separate announcement bar; the announcement lives in the header (see Header).

## Imagery
- Product cards: **4:5** (`aspect-garment`), `object-cover`, `paper-deep` while loading. The second image fades in on hover (desktop only).
- PDP: stacked 4:5 images on desktop, a horizontal snap carousel on mobile, inset to the page gutter.
- Editorial and hero: **full-bleed**, 3:4 on mobile and 16:9 or viewport height on desktop. Set text in paper on a 20–30% ink scrim placed at the bottom. Never use a solid box behind text.
- Do not add borders, rounded corners or drop shadows on images.

## Motion
- Animate only opacity and transform. Use `ease-out` (cubic-bezier .22,1,.36,1).
- Durations: 150ms for hover/colour, 220ms for fades and accordions, 300ms for drawers and sheets. No bounce.
- Links get a growing 1px underline (`link-underline`). Buttons press to `scale(.99)`.
- Under `prefers-reduced-motion`, durations drop to about 0. The skeleton sheen stops.

## Components (`@/components/ui`)
| Component | Props | Notes |
|---|---|---|
| `Button` | `variant: primary \| secondary \| quiet \| ghost \| inverse \| link`, `size: sm \| md \| lg`, `loading`, `fullWidth`, `iconLeft/Right` + button attrs | Tracked caps, square. Use one primary per view. `inverse` is for dark imagery. |
| `ButtonLink` | Next `Link` props + `variant`, `size`, `fullWidth` | A link styled as a button. `buttonClass(variant, size, full)` gives the class string. |
| `Input` | `label`, `hint`, `error`, `hideLabel`, **`labelStyle: 'top' \| 'floating'`**, **`trailing`** + input attrs | Top labels by default. Use floating labels in checkout. |
| `Select` | `label`, `options`, `placeholder`, `error`, `hideLabel` | Native select with a hairline chevron. |
| `Drawer` | `open`, `onClose`, `title`, `side: left \| right \| bottom`, `footer` | Focus trap, scroll lock, Escape and backdrop close. |
| `Sheet` | Same as Drawer minus `side` | Bottom sheet under 768px, right panel above. For quick-buy and checkout over the page. |
| `Dialog` | `open`, `onClose`, `title`, `description`, `footer` | Native `<dialog>`. |
| `Accordion` | `items: {id,title,content}[]`, `defaultOpen` | `<details>`, so it works without JS. |
| `Price` | `amount` (paise), `compareAt`, `size: sm \| md \| lg` | Tabular figures, oxblood when on sale. |
| `Badge` | `tone: neutral \| ink \| clay \| sale \| success \| inverse`, `variant: tag \| solid` | The care-label chip. At most one per card. |
| `Swatch` | `options: {value,label,hex?,image?,disabled?}[]`, `value`, `onChange`, `label`, `size: sm \| md` | Radiogroup with an offset ring for the selected chip. |
| `SizeSelector` | `options: {value,label,disabled?,note?}[]`, `value`, `onChange`, `label`, `aside`, `error` | Hairline grid cells. Sold out is struck through. `note` (for example "2 left") shows in clay. |
| `QuantityStepper` | `value`, `onChange`, `min`, `max`, `label`, `size: sm \| md`, `disabled` | Minus / value / plus in a hairline box. |
| `Skeleton` / `ProductCardSkeleton` | `shape: block \| text \| image`, `lines` | Sheen on paper-deep. |
| `ToastProvider` / `useToast` / `Toast` | `{title, description?, tone?, action?, duration?}` | Ink toast, bottom-centre on mobile and bottom-right on desktop, max 3. |
| `Spinner` | `size` | The brand ring turning. |
| `LogoWordmark`, `LogoSymbol`, `Wordmark` | `className`, `title` / `text` | A passed `className` replaces the default size. |

Chrome (`@/components/chrome`): `Header` (below), `SiteMenu` (the menu panel the header owns), `HeaderStatus` (the announcement line), `Footer` (newsletter and "Letters" note, link columns and contact, then one legal line with a modest wordmark and the ring symbol in clay; **no oversized logo**). `AnnouncementBar` and `MobileNav` are kept for compatibility but the storefront no longer mounts them.

## Header: "the masthead"
The top of the site is one quiet line of type, like the masthead and dateline of a printed journal. No slab, no second bar, no icons where a word will do.

**Composition (56px mobile, 64px from 768px).**
- Left: the wordmark, small (12px tall on mobile, 15px on desktop), at the gutter. It shares its left edge with the hero caption below, which gives the page one strong vertical.
- Beside the wordmark (768px and up): **the status line**, the site-content announcement folded into the header. A 6px clay dot that breathes slowly, the owner's words in 10px tracked caps, a 16px hairline, then a quiet sentence-case note such as "Sale opens 31 Oct". The whole line is a link. A small arrow slides in on hover.
- Right (1024px and up): the first **two** primary nav items, then `Menu`, then a gap, then the search glyph and `Bag 2`. Everything is 11px tracked caps on a 40px hit area with one shared baseline. The current page gets the 1px underline.
- Mobile: wordmark, then `Menu` and `Bag 0` only. `Menu` carries the clay dot when an announcement is live, and the status line sits at the top of the menu.
- The bag is a word with a count ("Bag 2", tabular figures), never an icon with a pill badge. `CartButton variant="text"` with `headerActionClass` provides this.

**Announcement rules** (`resolveAnnouncement` in `chrome/announcement.ts`). The site-content `announcement` text is used as typed. An owner `href` always wins. When there is no href and a pre-order piece is open, the status links to that product. The sale or close date is appended only when the text is about pre-orders and has no date of its own. `enabled: false` or blank text removes the status line and the mobile dot.

**Over a hero.** When the first element in `<main>` carries `data-chrome-hero` (the home `PresaleHero` and a leading `hero` block), the header overlays the photograph. It is transparent with paper type, and a soft ink shade (42% fading to nothing about 56px below the bar) keeps the type legible on light corners of the photograph. This shade is the only gradient in the system: a legibility mask, never decoration. The overlay is pure CSS (`body:has(...)` with a negative bottom margin), so the server render is already right and there is no flash or layout shift. When the hero has slid under the bar, the header turns to paper with a hairline (`data-solid`). Every other page starts in solid paper and gains the hairline once the page scrolls.

**Scroll.** Past 160px, reading down slides the header up (`translateY(-100%)`, 300ms ease-out). The first scroll up brings it back. It never hides while the menu is open or while focus is inside it. Under reduced motion the move is instant and the dot stops breathing.

**Menu (`SiteMenu`).** `Menu` becomes `Close`, and the bar stays in place. On desktop a paper panel drops beneath the bar with a hairline, over the page dimmed to ink/25. On mobile and tablet the panel is full screen. Contents: every primary item in Jost light (38 → 48 → 60px; on hover the others dim to 35%), with children as small links beneath; a hairline search field; the footer columns as small lists; and on mobile the status line at the top. Items rise in 45ms apart. On mobile the search field and lists sit at the bottom of the screen. Accessibility: `aria-expanded`/`aria-controls` on the trigger, focus moves to the first item, Tab is trapped across the bar and panel, Escape and backdrop click close it, focus returns to `Menu`, `#main` and the footer are `inert`, the page scroll locks, and opening the bag closes the menu first.

**Brand.** All header colour comes from `--hdr-fg` (ink, or paper over a hero), so Settings → Brand colours apply. Uploaded logos switch between `logoLight` on paper and `logoDark` over the hero.

## Do / don't
**Do:** let photographs run large · use hairlines to separate content · write short, specific copy in sentence case (labels are the only caps) · put one primary action on each screen · keep price, size and buy within thumb reach on mobile.
**Don't:** use gradients, shadows, pills or rounded cards · put boxed backgrounds behind hero text · use more than one badge on a card · use emoji · write "Shop now!" · put tracked caps on anything longer than 4 words · use clay for text on paper (too low contrast) · make the logo bigger than the nav needs.
