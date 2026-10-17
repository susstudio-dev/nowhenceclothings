import { ButtonLink } from '@/components/ui/ButtonLink';

export default function NotFound() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-start justify-center py-section md:items-center md:text-center">
      <p className="care-tag">404</p>
      <h1 className="mt-6 max-w-xl text-balance font-display text-display font-light">This piece isn&apos;t here.</h1>
      <p className="mt-4 max-w-sm text-small text-ink-soft">It may have sold through, or the link has moved. The rest of the collection is a step away.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/shop">Shop all</ButtonLink>
        <ButtonLink href="/" variant="secondary">Home</ButtonLink>
      </div>
    </section>
  );
}
