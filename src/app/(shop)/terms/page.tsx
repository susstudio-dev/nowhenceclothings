import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('terms');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('terms');
  return <StaticPageView slug="terms" page={page} vars={vars} />;
}
