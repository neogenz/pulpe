/**
 * The screens that open on the forest hero, by path. Their app bar is forest
 * too and runs up under the status bar, so the clock and the battery have to
 * turn light there and only there — the rest of the app sits on the sage
 * canvas, where light icons would vanish.
 *
 * Decided from the path rather than by each screen on focus: the tabs keep
 * every visited screen mounted, and a status bar declared by a screen that is
 * no longer in front would keep winning.
 */
const HERO_PATHS = [
  /^\/home$/,
  /^\/budgets$/,
  /^\/budget\/(?!plan$|create$)[^/]+$/,
  /^\/goal\/[^/]+$/,
];

export function isHeroPath(pathname: string): boolean {
  return HERO_PATHS.some((pattern) => pattern.test(pathname));
}
