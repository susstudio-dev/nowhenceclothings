import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './Button';
import { cn } from './cn';

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** A Next <Link> styled as a Button. */
export function ButtonLink({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClass(variant, size, fullWidth), className)} {...rest} />;
}
