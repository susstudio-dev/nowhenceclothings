import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('privacy');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('privacy');
  return <StaticPageView slug="privacy" page={page} vars={vars} />;
}
