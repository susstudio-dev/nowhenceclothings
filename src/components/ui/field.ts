/** Shared class strings for form controls (Input, Select). */
export const fieldLabel = 'text-label uppercase text-ink-soft';
export const fieldControl =
  'h-12 w-full rounded-none border border-line bg-paper px-4 text-body text-ink placeholder:text-muted/80 ' +
  'transition-[border-color,box-shadow] duration-fast ease-out hover:border-muted focus:border-ink focus:outline-none ' +
  'focus:shadow-[inset_0_0_0_1px_rgb(var(--c-ink))] ' +
  'disabled:cursor-not-allowed disabled:bg-paper-deep disabled:opacity-60 aria-[invalid=true]:border-sale';
/** Floating-label control: room above the value for the label. */
export const fieldControlFloating = 'peer pt-5 pb-1 placeholder:text-transparent';
export const fieldFloatingLabel =
  'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 origin-left text-small text-muted transition-all duration-base ease-out ' +
  'peer-focus:top-3.5 peer-focus:text-[0.6875rem] peer-focus:tracking-wide ' +
  'peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[0.6875rem] peer-[:not(:placeholder-shown)]:tracking-wide';
export const fieldHint = 'text-caption text-muted';
export const fieldError = 'text-caption text-sale';
