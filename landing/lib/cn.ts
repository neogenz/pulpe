/**
 * Simple utility to merge class names, filtering out falsy values.
 * Lightweight alternative to clsx/tailwind-merge.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
