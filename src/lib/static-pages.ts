import type { Page } from './schemas/site-content';
import type { SettingsDoc } from './schemas/settings';
import { formatPaise } from './money';
import { formatLegalDate } from './brand';
import { displayPhone, etaSentence, instagramHandle, shippingSummary, whatsappUrl } from './store-copy';
import { socialUrl } from './seo';

// Default copy for the S9 static pages (WS-E). Admin-edited pages in
// site-content.json win; these render when a page is missing or still holds
// the Phase 0 seed placeholder. `{{token}}` values come from settings; an
// empty value renders as [[TBD]] (see DECISIONS open questions).

export type StaticSlug = 'about' | 'contact' | 'faq' | 'size-guide' | 'shipping' | 'returns' | 'privacy' | 'terms';

const md = (id: string, markdown: string) => ({ type: 'richText' as const, id, markdown });

export const DEFAULT_STATIC_PAGES: Record<StaticSlug, Page> = {
  about: {
    slug: 'about',
    title: 'About',
    seo: {
      title: 'About Nowhence: played hard, worn after',
      description:
        'Nowhence makes embroidered polos for the people who play: tennis, padel, pickleball, golf. Every polo carries an animal. Designed in India.',
    },
    blocks: [
      md(
        'about-body',
        `# Played hard. Worn after.

{{brandName}} started on the court. We played, and afterwards we sat around in clothes that looked like we'd just played. Gym tees, faded polos, nothing we were proud of. So we set out to make the polo we wanted. Heavy enough to hold its shape, soft enough to live in, and embroidered with something worth looking at twice.

Every {{brandName}} polo carries an animal. Each one stands for a way of playing: the patient panther, the watchful kestrel, the unbothered crocodile. Pick the one that plays like you.

## How we make them

- **One fabric, done properly.** 240 GSM mercerised cotton piqué, chosen for weight, sheen and how it washes.
- **Small runs.** We make each design in limited numbers. When a run is gone, it's gone.
- **Made in India.** Designed in India, made with partners we know and visit.

## Who we are

{{brandName}} is founded by Sanjan Avasarala, under Sanbhanu Private Limited. We still answer every message ourselves:

{{contactList}}`,
      ),
    ],
  },
  contact: {
    slug: 'contact',
    title: 'Contact',
    seo: { title: 'Contact Nowhence', description: 'Questions about an order, a size or a piece? Message Nowhence on WhatsApp or email. We reply within one working day.' },
    blocks: [
      md(
        'contact-body',
        `# Contact

Write to us. A person reads every message and replies within one working day.

{{contactList}}

For an order, include your order number. It starts with NWH and is in your confirmation email. You can also [track an order](/orders/track) yourself.`,
      ),
    ],
  },
  faq: {
    slug: 'faq',
    title: 'FAQ',
    seo: { title: 'FAQ: sizing, shipping and returns', description: 'Sizing, shipping, pre-orders, returns and embroidery care. Short answers to common questions about Nowhence polos.' },
    blocks: [
      {
        type: 'faq',
        id: 'faq-items',
        items: [
          { q: 'How does sizing work?', a: 'Every polo is cut on one unisex, regular-fit block. Measure your chest and find it in the [size guide](/size-guide): each size lists the body chest it fits. Between sizes? Size down for a closer, athletic look, up for a relaxed one.' },
          { q: 'What does shipping cost?', a: '{{shippingSummary}}' },
          { q: 'How long does delivery take?', a: '{{eta}} for in-stock pieces. Pre-orders ship within 2–3 weeks of the sale opening. Delivery takes another 2–6 working days, depending on your PIN code.' },
          { q: 'Can I return or exchange?', a: '{{returnsSummary}} Pieces must be unworn and with tags. Pre-ordered pieces get one free size exchange within the same window. Read the [returns policy](/returns).' },
          { q: 'Do prices include tax?', a: 'Yes. All prices include GST.' },
          { q: 'How do I pay?', a: 'Cards, UPI, net banking and wallets, through Razorpay. We do not store your card details.' },
          { q: 'Will a sold-out size come back?', a: 'Sometimes. Choose the size and select "Notify me". We will write once, when it returns.' },
          { q: 'How should I care for the embroidery?', a: 'Machine wash cold, inside out, on a gentle cycle. Do not bleach. Dry in the shade. Iron on the reverse, never directly on the embroidery.' },
          { q: 'Where are the polos made?', a: 'Designed and embroidered in India, in small runs.' },
        ],
      },
    ],
  },
  'size-guide': {
    slug: 'size-guide',
    title: 'Size guide',
    seo: { title: 'Polo size guide', description: 'Real garment measurements for every Nowhence polo, in inches and centimetres, with the body chest each size fits and how to measure.' },
    blocks: [
      md(
        'size-guide-intro',
        `# Size guide

Garment measurements, taken flat and doubled. Inches first, centimetres below. Every polo is unisex.

Lay your favourite polo flat and measure it. Then pick the closest size below.

Not sure? Send us your height and chest measurement and we will tell you which size to take.

{{contactList}}`,
      ),
    ],
  },
  shipping: {
    slug: 'shipping',
    title: 'Shipping',
    seo: { title: 'Shipping across India', description: 'Nowhence ships across India, tracked to your door. What shipping costs, when pieces leave us, and how pre-orders ship.' },
    blocks: [
      md(
        'shipping-body',
        `# Shipping

We ship to every serviceable PIN code in India. International shipping is not yet available.

## Cost

{{shippingSummary}} Anywhere in India.

## Timing

{{eta}} for in-stock pieces. Pre-orders ship within 2–3 weeks of the sale opening. Delivery then takes 2–6 working days, depending on your PIN code. Remote areas may take longer.

## Tracking

When your order ships, we email a tracking link. You can also [track your order](/orders/track) with your order number and email.

## Drops

Pieces from a drop ship once the drop is released. If your order mixes released and upcoming pieces, it ships together when everything is ready.`,
      ),
    ],
  },
  returns: {
    slug: 'returns',
    title: 'Returns & exchange',
    seo: { title: 'Returns & exchange', description: 'Return or exchange unworn Nowhence pieces within the return window. How it works, and when refunds arrive.' },
    blocks: [
      md(
        'returns-body',
        `# Returns & exchange

If something is not right, send it back.

## The window

{{returnsSummary}}

{{returnsPolicy}}

## How to start

Write to [{{email}}](mailto:{{email}}) with your order number and what you would like: {{returnsAsk}}. We will arrange a pickup where available.`,
      ),
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy policy',
    seo: { title: 'Privacy policy', description: 'What personal data Nowhence collects, why, and how it is stored and protected.' },
    blocks: [
      md(
        'privacy-body',
        `# Privacy policy

This policy explains what we collect when you use nowhenceclothings.com, and why. The site is operated by {{legalName}}, {{registeredAddress}}.

## What we collect

- **Order details**: name, email, phone and shipping address, so we can deliver and support your order.
- **Payment**: handled by Razorpay. We receive a payment reference, never your card or bank details.
- **Newsletter**: your email, only if you sign up. Unsubscribe at any time from any email.
- **Notify-me requests**: your email and the size you asked about.

We do not use advertising trackers. Your cart is stored in your own browser.

## How we use it

To fulfil orders, answer messages and, if you agreed, send occasional news. We do not sell or rent personal data.

## Who we share it with

Only the services that run the shop: our host and storage (Cloudflare), payments (Razorpay), email delivery and courier partners. Each receives only what it needs.

## Retention

Order records are kept as long as tax law requires. Newsletter data is deleted when you unsubscribe.

## Your rights

You can ask to see, correct or delete your data. Write to [{{email}}](mailto:{{email}}).

Last updated: {{privacyUpdatedAt}}.`,
      ),
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of sale',
    seo: { title: 'Terms of sale', description: 'The terms that apply when you buy from Nowhence: pricing, payment, delivery, returns and liability.' },
    blocks: [
      md(
        'terms-body',
        `# Terms of sale

These terms apply to purchases on nowhenceclothings.com, operated by {{legalName}} (GSTIN {{gstin}}), {{registeredAddress}}.

## Prices

Prices are in Indian rupees and include GST. We may change prices at any time; the price at checkout is the price you pay.

## Orders

An order is confirmed once payment succeeds and you receive a confirmation email. We may cancel an order if a piece is unavailable or a price was shown in error. Any payment is then refunded in full.

## Delivery

See [Shipping](/shipping). Delivery times are estimates, not guarantees.

## Returns

See the [returns policy](/returns).

## Liability

Our liability is limited to the value of the order. Nothing here limits rights you have under the Consumer Protection Act, 2019.

## Governing law

These terms are governed by the laws of India. Courts at {{jurisdictionCity}} have jurisdiction.

Last updated: {{termsUpdatedAt}}.`,
      ),
    ],
  },
};

export const STATIC_SLUGS = Object.keys(DEFAULT_STATIC_PAGES) as StaticSlug[];

const PLACEHOLDER = /^\s*placeholder\b.*\bcopy\.?\s*$/i;

/** True when a stored page is still the Phase 0 seed placeholder. */
export function isPlaceholderPage(page: Page | undefined): boolean {
  if (!page || page.blocks.length === 0) return true;
  return page.blocks.every((b) => b.type === 'richText' && PLACEHOLDER.test(b.markdown));
}

/** Stored page when it has real copy, otherwise the default for this slug. */
export function resolveStaticPage(slug: StaticSlug, stored: Page | undefined): Page {
  return isPlaceholderPage(stored) ? DEFAULT_STATIC_PAGES[slug] : stored!;
}

/** Markdown list of the ways to reach the store, skipping unset channels. */
export function contactList(store: Pick<SettingsDoc['store'], 'email' | 'phone' | 'instagram'>): string {
  const wa = whatsappUrl(store.phone);
  const ig = socialUrl(store.instagram, 'instagram');
  const handle = instagramHandle(store.instagram);
  return [
    wa && `- WhatsApp: [${displayPhone(store.phone)}](${wa})`,
    store.email && `- Email: [${store.email}](mailto:${store.email})`,
    ig && handle && `- Instagram: [${handle}](${ig})`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Template variables for `fillTemplate`, from store settings (A9: legal, returns, brand). */
export function settingsVars(settings: SettingsDoc): Record<string, string> {
  const r = settings.returns;
  const days = String(r.windowDays);
  const what =
    r.returnsAllowed && r.exchangesAllowed
      ? 'a return or exchange'
      : r.returnsAllowed
        ? 'a return'
        : r.exchangesAllowed
          ? 'an exchange'
          : '';
  return {
    brandName: settings.store.name,
    email: settings.store.email,
    phone: settings.store.phone,
    address: settings.store.address,
    legalName: settings.legal.legalName,
    gstin: settings.legal.gstin,
    registeredAddress: settings.legal.registeredAddress || settings.store.address,
    jurisdictionCity: settings.legal.jurisdictionCity,
    privacyUpdatedAt: formatLegalDate(settings.legal.privacyUpdatedAt),
    termsUpdatedAt: formatLegalDate(settings.legal.termsUpdatedAt),
    eta: etaSentence(settings.shipping.eta),
    shippingSummary: shippingSummary(settings.shipping),
    contactList: contactList(settings.store),
    flatFee: formatPaise(settings.shipping.flatFee),
    freeShippingThreshold: formatPaise(settings.shipping.freeShippingThreshold),
    returnWindowDays: days,
    returnsSummary: what
      ? `You have ${days} days from delivery to ask for ${what}.`
      : 'We do not accept returns or exchanges, except for faulty or wrongly sent pieces. Write to us within 48 hours of delivery.',
    returnsAsk:
      r.returnsAllowed && r.exchangesAllowed
        ? 'a different size, or a refund'
        : r.returnsAllowed
          ? 'a refund'
          : r.exchangesAllowed
            ? 'a different size'
            : 'a replacement for a faulty piece',
    returnsPolicy: r.policyMarkdown,
  };
}

/** F14: label for /returns that matches what the store actually offers. */
export function returnsLabel(r: Pick<SettingsDoc['returns'], 'returnsAllowed' | 'exchangesAllowed'>): string {
  if (r.returnsAllowed && r.exchangesAllowed) return 'Returns & exchange';
  if (r.returnsAllowed) return 'Returns';
  if (r.exchangesAllowed) return 'Exchanges';
  return 'Returns policy';
}

/** Labels we generate (or seeded) for /returns; an owner's custom label is left alone. */
const AUTO_RETURNS_LABELS = new Set(['returns & exchange', 'returns & exchanges', 'returns and exchanges', 'returns', 'exchanges', 'returns policy']);

/** Swap a seeded/auto /returns label for the settings-derived one. */
export function resolveReturnsLabel(label: string, settings: Pick<SettingsDoc, 'returns'>): string {
  return AUTO_RETURNS_LABELS.has(label.trim().toLowerCase()) ? returnsLabel(settings.returns) : label;
}

/** Footer/nav links with the /returns label derived from settings. */
export function withReturnsNavLabel<T extends { href: string; label: string }>(links: T[], settings: Pick<SettingsDoc, 'returns'>): T[] {
  return links.map((l) => (l.href === '/returns' ? { ...l, label: resolveReturnsLabel(l.label, settings) } : l));
}

/** The /returns page with its title, SEO title and auto heading matched to settings. */
export function withReturnsTitle(page: Page, settings: Pick<SettingsDoc, 'returns'>): Page {
  const title = resolveReturnsLabel(page.title, settings);
  const seoTitle = page.seo?.title ? resolveReturnsLabel(page.seo.title, settings) : page.seo?.title;
  const blocks = page.blocks.map((b) =>
    b.type === 'richText'
      ? { ...b, markdown: b.markdown.replace(/^#\s+(.+)$/m, (_, h: string) => `# ${resolveReturnsLabel(h, settings)}`) }
      : b,
  );
  return { ...page, title, seo: page.seo ? { ...page.seo, title: seoTitle } : page.seo, blocks };
}
