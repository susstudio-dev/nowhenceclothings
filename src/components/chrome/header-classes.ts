/**
 * Bar actions (Menu, Bag, Search): tracked caps in the header's state colour.
 * Plain module (not 'use client') so the server layout can hand it to the cart slot.
 */
export const headerActionClass =
  'inline-flex h-10 select-none items-center gap-[0.55em] font-sans text-label uppercase text-current transition-opacity duration-fast ease-out hover:opacity-60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2';
