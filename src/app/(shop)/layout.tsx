import type { ReactNode } from 'react';
import { AnnouncementBar, Footer, Header } from '@/components/chrome';
import { CartButton } from '@/components/shop/cart-drawer';
import { NewsletterForm } from '@/components/shop/NewsletterForm';
import { getSettings, getSiteContent } from '@/lib/content';
import { jsonLdScript, organizationLd, webSiteLd } from '@/lib/jsonld';
import { withReturnsNavLabel } from '@/lib/static-pages';

// Header renders the skip link; CartButton mounts the single CartDrawer.
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [content, settings] = await Promise.all([getSiteContent(), getSettings()]);
  const brand = {
    name: settings.store.name,
    wordmark: settings.brand.wordmark,
    logoLight: settings.brand.logoLight,
    logoDark: settings.brand.logoDark,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript([organizationLd(settings), webSiteLd()]) }}
      />
      <AnnouncementBar announcement={content.announcement} />
      <Header nav={content.nav.primary} cartSlot={<CartButton />} brand={brand} />
      <main id="main">{children}</main>
      <Footer columns={content.nav.footer.map((col) => ({ ...col, links: withReturnsNavLabel(col.links, settings) }))} newsletter={<NewsletterForm source="footer" />} email={settings.store.email}
        brand={brand}
        legalName={settings.legal.legalName || undefined}
      />
    </>
  );
}
