import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from 'pulpe-shared';

/* eslint-disable boundaries/no-unknown -- JSON assets, not layer imports */
import fr from '../../../../public/i18n/fr.json';
import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
// `it` seul entrerait en collision avec le `it` de Vitest, importé juste au-dessus.
import italian from '../../../../public/i18n/it.json';
/* eslint-enable boundaries/no-unknown */

const CATALOGS: Record<string, unknown> = { fr, en, de, it: italian };

function leaves(node: unknown, prefix = '', out = new Map<string, string>()) {
  if (typeof node === 'string') {
    out.set(prefix, node);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      leaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

/**
 * Interpolation tokens, normalised. `fr.json` writes both `{{date}}` and
 * `{{ date }}`; the spacing carries nothing, the name carries everything.
 * Comparing raw would flag a translation that merely picked the other spacing.
 */
function tokens(value: string): string {
  return [...value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
    .map(([, name]) => name)
    .sort()
    .join('|');
}

/**
 * Markup as a multiset, never a sequence. Word order moves between languages —
 * German legitimately puts a `<strong>` where French does not — so only the
 * opened and closed tags have to match. Attributes are dropped: none of these
 * strings carries one, and a translator has no business adding one.
 */
function markup(value: string): string {
  return [...value.matchAll(/<(\/?)([a-z]+)[^>]*>/gi)]
    .map(([, slash, name]) => `${slash}${name.toLowerCase()}`)
    .sort()
    .join('|');
}

/**
 * The whitespace that carries meaning: the line breaks a sentence is built
 * around, and the edges a caller concatenates against. Inner spacing is the
 * translator's business and stays free.
 */
function whitespaceShape(value: string): string {
  const lineBreaks = (value.match(/\n/g) ?? []).length;
  const leading = value.length - value.trimStart().length;
  const trailing = value.length - value.trimEnd().length;
  return `${lineBreaks}|${leading}|${trailing}`;
}

const source = leaves(CATALOGS[DEFAULT_LOCALE]);
const translations = SUPPORTED_LOCALES.filter(
  (lang) => lang !== DEFAULT_LOCALE,
);

/**
 * The keys whose translation no longer has the French shape. A key missing from
 * the translation is not drift — the key-set assertion above owns that case and
 * reporting it twice would double every failure.
 */
function driftedKeys(lang: string, shapeOf: (value: string) => string) {
  const translated = leaves(CATALOGS[lang]);

  return [...source.entries()]
    .filter(([key, french]) => {
      const other = translated.get(key);
      return other !== undefined && shapeOf(french) !== shapeOf(other);
    })
    .map(([key]) => key);
}

describe('i18n catalogs', () => {
  it('holds a non-trivial French source', () => {
    // Guards the guard: an empty or unresolved import would make every
    // assertion below pass while proving nothing.
    expect(source.size).toBeGreaterThan(1000);
  });

  it.each(translations)('gives %s exactly the French key set', (lang) => {
    const translated = leaves(CATALOGS[lang]);

    const missing = [...source.keys()].filter((key) => !translated.has(key));
    const extra = [...translated.keys()].filter((key) => !source.has(key));

    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(translations)('keeps every %s interpolation token', (lang) => {
    expect(driftedKeys(lang, tokens)).toEqual([]);
  });

  it.each(translations)('keeps every %s markup tag', (lang) => {
    expect(driftedKeys(lang, markup)).toEqual([]);
  });

  it.each(translations)('keeps the %s line breaks and edge spacing', (lang) => {
    expect(driftedKeys(lang, whitespaceShape)).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('leaves no empty string in %s', (lang) => {
    const empty = [...leaves(CATALOGS[lang]).entries()]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
