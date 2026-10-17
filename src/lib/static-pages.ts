import type { Page } from './schemas/site-content';
import type { SettingsDoc } from './schemas/settings';
import { formatPaise } from './money';
import { formatLegalDate } from './brand';

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
      title: 'About',
      description:
        'Nowhence is a unisex clothing label. Fewer pieces, better cloth, cut to be worn by anyone and kept for years.',
    },
    blocks: [
      md(
        'about-body',
        `# Made from nowhere in particular

{{brandName}} began with a simple question. Why do clothes need a gender, a season or a trend to justify them?

We make a small range of unisex pieces. Heavyweight cotton. Honest twill. Colours that sit quietly together. Each piece is cut on one block and graded across sizes XS to XXL, so the fit is decided by the body, not a label.

## How we work

- Fewer styles, made well. We would rather remake a good shirt than invent a new one.
- Fabric first. We choose the cloth, then design around it.
- Released in drops. Small runs mean less waste and nothing on sale for long.

## Where we are

{{brandName}} is designed in India and made with partners we visit. Our studio is at {{address}}.`,
      ),
    ],
  },
  contact: {
    slug: 'contact',
    title: 'Contact',
    seo: { title: 'Contact', description: 'Questions about an order, a size or a piece? Write to Nowhence. We reply within one working day.' },
    blocks: [
      md(
        'contact-body',
        `# Contact

Write to us. A person reads every message and replies within one working day.

- Email: [{{email}}](mailto:{{email}})
- Phone: {{phone}}
- Studio: {{address}}

For an order, include your order number. It starts with NWH and is in your confirmation email. You can also [track an order](/orders/track) yourself.`,
      ),
    ],
  },
  faq: {
    slug: 'faq',
    title: 'FAQ',
    seo: { title: 'FAQ', description: 'Sizing, shipping, returns and care. Short answers to common questions about Nowhence.' },
    blocks: [
      {
        type: 'faq',
        id: 'faq-items',
        items: [
          { q: 'How does unisex sizing work?', a: 'Every piece is cut on one block. Choose by chest measurement. If you are between sizes, size down for a closer fit, up for a relaxed one. See the [size guide](/size-guide).' },
          { q: 'How long does delivery take?', a: '{{eta}}. Delivery across India usually takes a further 2 to 6 working days, depending on your PIN code.' },
          { q: 'What does shipping cost?', a: 'A flat {{flatFee}}. Orders of {{freeShippingThreshold}} or more ship free.' },
          { q: 'Can I return or exchange?', a: '{{returnsSummary}} Pieces must be unworn and with tags. Read the [returns policy](/returns).' },
          { q: 'Do prices include tax?', a: 'Yes. All prices include GST.' },
          { q: 'How do I pay?', a: 'Cards, UPI, net banking and wallets, through Razorpay. We do not store your card details.' },
          { q: 'Will a sold-out size come back?', a: 'Sometimes. Choose the size and select "Notify me". We will write once, when it returns.' },
          { q: 'How should I care for my pieces?', a: 'Wash cold, inside out, with similar colours. Dry in the shade. Each product page lists its own care.' },
        ],
      },
    ],
  },
  'size-guide': {
    slug: 'size-guide',
    title: 'Size guide',
    seo: { title: 'Size guide', description: 'Unisex measurements for every Nowhence piece, in centimetres and inches, with notes on how to measure.' },
    blocks: [
      md(
        'size-guide-intro',
        `# Size guide

All {{brandName}} pieces are unisex. Measurements below are of the garment laid flat, not the body.

## How to measure

- **Chest**: across the garment, armpit to armpit, then doubled.
- **Length**: from the highest point of the shoulder to the hem.
- **Shoulder**: seam to seam across the back.

Compare with a piece you already own and like. That is the most reliable guide.`,
      ),
    ],
  },
  shipping: {
    slug: 'shipping',
    title: 'Shipping',
    seo: { title: 'Shipping', description: 'Nowhence ships across India. Flat-rate shipping, free above a threshold, tracked to your door.' },
    blocks: [
      md(
        'shipping-body',
        `# Shipping

We ship to every serviceable PIN code in India. International shipping is not yet available.

## Cost

- A flat {{flatFee}} per order.
- Free on orders of {{freeShippingThreshold}} or more.

## Timing

{{eta}}. Most orders then arrive within 2 to 6 working days. Remote areas may take longer.

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

See [Returns & exchange](/returns).

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
    eta: settings.shipping.eta,
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
