import { describe, expect, it, afterEach, vi } from 'vitest';
import { pinBrowserLanguage } from '@app/testing/browser-language';
import type { StorageService } from '../storage/storage.service';
import { resolveStartupLanguage } from './language-resolver';

function storageReturning(value: unknown): StorageService & {
  setString: ReturnType<typeof vi.fn>;
} {
  return {
    get: () => value,
    setString: vi.fn(),
  } as unknown as StorageService & { setString: ReturnType<typeof vi.fn> };
}

describe('resolveStartupLanguage', () => {
  afterEach(() => {
    pinBrowserLanguage();
  });

  it('prefers the stored choice over the browser', () => {
    pinBrowserLanguage('de-DE');
    expect(resolveStartupLanguage(storageReturning('it'), '?lang=en')).toBe(
      'it',
    );
  });

  it.each(['fr', 'en', 'de', 'it'] as const)(
    'uses and stores a valid CTA locale (%s) when no choice exists',
    (locale) => {
      pinBrowserLanguage('fr-CH');
      const storage = storageReturning(null);

      expect(
        resolveStartupLanguage(storage, `?utm_source=landing&lang=${locale}`),
      ).toBe(locale);
      expect(storage.setString).toHaveBeenCalledWith(
        'pulpe-settings-language',
        locale,
      );
    },
  );

  it('ignores an unknown CTA locale and does not persist it', () => {
    pinBrowserLanguage('de-CH');
    const storage = storageReturning(null);

    expect(resolveStartupLanguage(storage, '?lang=es')).toBe('de');
    expect(storage.setString).not.toHaveBeenCalled();
  });

  it('collapses a regional browser language to its short code', () => {
    pinBrowserLanguage('de-CH');
    expect(resolveStartupLanguage(storageReturning(null))).toBe('de');
  });

  it('falls back to French for a language Pulpe does not ship', () => {
    pinBrowserLanguage('es-ES');
    expect(resolveStartupLanguage(storageReturning(null))).toBe('fr');
  });

  it('falls back to French when the browser states no language', () => {
    pinBrowserLanguage(undefined);
    expect(resolveStartupLanguage(storageReturning(null))).toBe('fr');
  });

  it('ignores a stored value the schema rejects', () => {
    // The storage service validates on read and returns null; this proves the
    // resolver treats that null as "never chosen" rather than crashing.
    pinBrowserLanguage('en-GB');
    expect(resolveStartupLanguage(storageReturning(null))).toBe('en');
  });
});
