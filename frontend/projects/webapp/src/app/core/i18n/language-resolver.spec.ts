import { describe, expect, it, afterEach } from 'vitest';
import { pinBrowserLanguage } from '@app/testing/browser-language';
import type { StorageService } from '../storage/storage.service';
import { resolveStartupLanguage } from './language-resolver';

function storageReturning(value: unknown): StorageService {
  return { get: () => value } as unknown as StorageService;
}

describe('resolveStartupLanguage', () => {
  afterEach(() => {
    pinBrowserLanguage();
  });

  it('prefers the stored choice over the browser', () => {
    pinBrowserLanguage('de-DE');
    expect(resolveStartupLanguage(storageReturning('it'))).toBe('it');
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
