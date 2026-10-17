import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('contact');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('contact');
  return <StaticPageView slug="contact" page={page} vars={vars} />;
}
