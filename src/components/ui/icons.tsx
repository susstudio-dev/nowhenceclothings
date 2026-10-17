import type { ReactNode, SVGProps } from 'react';

/** Hairline icons: 20px box, 1.25 stroke, currentColor. Decorative (aria-hidden) by default. */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Svg>
);
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7h14M3 13h14" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l4 4" />
  </Svg>
);
export const IconBag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h12l-1 10H5L4 7z" />
    <path d="M7.5 7V5.5a2.5 2.5 0 015 0V7" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4v12M4 10h12" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10h12" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8l5 5 5-5" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10h13M12 6l4 4-4 4" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="7" r="3" />
    <path d="M4 17c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" />
  </Svg>
);
