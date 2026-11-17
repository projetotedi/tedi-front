/**
 * The text link of the screens: the same as the one of the `lessons`, `classes` and `catalog`
 * screens, copied because a module does not import the inside of another (the copies may drift
 * apart on their own). The 44px height is the target of the touch, and `-mx-1 px-1` leaves room for
 * the focus ring around the text.
 */
export const LINK_CLASSES =
  "-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus";
