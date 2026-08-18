/**
 * The language the suite runs under, pinned once in `test-setup.ts`.
 *
 * jsdom reports `en-US`, so anything reaching `getBrowserLang()` resolves to
 * English — `LOCALE_ID` included, which then formats dates the English way and
 * breaks the ~157 assertions written against French copy, with a diff that
 * points at the date rather than at the cause.
 */
export const TEST_BROWSER_LANGUAGE = 'fr-FR';

/**
 * Pins the language jsdom reports.
 *
 * `getBrowserLang()` is a plain module export and cannot be spied on: the
 * builder bundles first-party code with esbuild and the namespace is frozen
 * (`Cannot redefine property`). What the function actually reads is
 * `navigator.languages?.[0] ?? navigator.language`, so overriding those two as
 * own properties is the seam.
 *
 * Pass `undefined` for a browser that states no language. A spec that changes
 * the pin restores it with a bare `pinBrowserLanguage()` — spec files in one
 * worker share the same jsdom window, `isolate` being off.
 */
export function pinBrowserLanguage(
  tag: string | undefined = TEST_BROWSER_LANGUAGE,
): void {
  define('languages', tag === undefined ? [] : [tag]);
  define('language', tag ?? '');
}

function define(key: 'languages' | 'language', value: unknown): void {
  Object.defineProperty(window.navigator, key, { value, configurable: true });
}
