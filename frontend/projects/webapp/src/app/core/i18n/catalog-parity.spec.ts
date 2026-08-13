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
function tokens(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
    .map(([, name]) => name)
    .sort();
}

const source = leaves(CATALOGS[DEFAULT_LOCALE]);
const translations = SUPPORTED_LOCALES.filter(
  (lang) => lang !== DEFAULT_LOCALE,
);

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
    const translated = leaves(CATALOGS[lang]);

    const drifted = [...source.entries()]
      .filter(([key, french]) => {
        const other = translated.get(key);
        return (
          other !== undefined &&
          tokens(french).join('|') !== tokens(other).join('|')
        );
      })
      .map(([key]) => key);

    expect(drifted).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('leaves no empty string in %s', (lang) => {
    const empty = [...leaves(CATALOGS[lang]).entries()]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
