import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_LOCALES,
  supportedLocaleSchema,
  updateUserSettingsSchema,
  userSettingsSchema,
} from '../schemas.js';
import { DEFAULT_LOCALE, LOCALE_METADATA } from './locale.js';

describe('supportedLocaleSchema', () => {
  it.each(SUPPORTED_LOCALES)('should accept valid locale: %s', (locale) => {
    const result = supportedLocaleSchema.safeParse(locale);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(locale);
    }
  });

  // Regional variants are rejected on purpose: the region comes from the
  // currency, never from the interface language.
  it.each(['es', 'de-CH', 'fr-FR', 'FR', '', 0, null, undefined])(
    'should reject invalid value: %s',
    (value) => {
      const result = supportedLocaleSchema.safeParse(value);
      expect(result.success).toBe(false);
    },
  );
});

describe('LOCALE_METADATA', () => {
  it('should cover exactly the supported locales', () => {
    expect(Object.keys(LOCALE_METADATA).sort()).toEqual(
      [...SUPPORTED_LOCALES].sort(),
    );
  });

  it('should name each language in its own language', () => {
    expect(LOCALE_METADATA).toEqual({
      fr: { nativeName: 'Français' },
      en: { nativeName: 'English' },
      de: { nativeName: 'Deutsch' },
      it: { nativeName: 'Italiano' },
    });
  });

  it('should default to a supported locale', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });
});

describe('user settings locale field', () => {
  it('should preserve an absent server preference', () => {
    const result = userSettingsSchema.parse({
      payDayOfMonth: null,
      currency: 'CHF',
      showCurrencySelector: false,
    });
    expect(result.locale).toBeUndefined();
  });

  it('should accept an update carrying only the locale', () => {
    expect(updateUserSettingsSchema.parse({ locale: 'de' })).toEqual({
      locale: 'de',
    });
  });

  it('should reject an unsupported locale on update', () => {
    expect(updateUserSettingsSchema.safeParse({ locale: 'es' }).success).toBe(
      false,
    );
  });
});
