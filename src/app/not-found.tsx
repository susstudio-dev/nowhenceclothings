import type { Metadata } from 'next';
import ShopLayout from './(shop)/layout';
import NotFound from './(shop)/not-found';

// Unmatched URLs (typos, old links) land here, outside the (shop) group. Give
// them the storefront chrome and a real title instead of Next's bare default.
// The status stays 404. Next adds its own noindex; saying it here too keeps it
// from sitting beside the site-wide `index, follow` default as a conflicting tag.
export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: true } };

export default function RootNotFound() {
  return (
    <ShopLayout>
      <NotFound />
    </ShopLayout>
  );
}
