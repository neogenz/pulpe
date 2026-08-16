import {
  EnvironmentInjector,
  provideZonelessChangeDetection,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { SupportedLocale } from 'pulpe-shared';
import { AppCurrencyPipe } from './currency/app-currency.pipe';
import { localeIdFactory } from './locale';
import { STORAGE_KEYS } from './storage/storage-keys';
import { StorageService } from './storage/storage.service';

function configureWithPersisted(
  currency: 'CHF' | 'EUR' | null,
  language: SupportedLocale | null = 'fr',
): void {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: StorageService,
        useValue: {
          get: (key: string) => {
            if (key === STORAGE_KEYS.SETTINGS_CURRENCY) return currency;
            if (key === STORAGE_KEYS.SETTINGS_LANGUAGE) return language;
            return null;
          },
        },
      },
    ],
  });
}

function resolveLocale(): string {
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => localeIdFactory());
}

describe('localeIdFactory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns fr-CH when CHF is persisted', () => {
    configureWithPersisted('CHF');
    expect(resolveLocale()).toBe('fr-CH');
  });

  it('returns fr-FR when EUR is persisted', () => {
    configureWithPersisted('EUR');
    expect(resolveLocale()).toBe('fr-FR');
  });

  it('defaults to fr-CH when no currency is persisted', () => {
    configureWithPersisted(null);
    expect(resolveLocale()).toBe('fr-CH');
  });

  it('defaults to fr-CH when the persisted value fails schema validation', () => {
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS_CURRENCY,
      JSON.stringify({
        version: 1,
        data: 'USD',
        updatedAt: new Date().toISOString(),
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    expect(resolveLocale()).toBe('fr-CH');
  });

  it('keeps the region on the currency while the language carries the words', () => {
    configureWithPersisted('CHF', 'en');
    expect(resolveLocale()).toBe('en-CH');

    TestBed.resetTestingModule();
    configureWithPersisted('EUR', 'de');
    expect(resolveLocale()).toBe('de-DE');
  });
});

describe('amount formatting', () => {
  /**
   * The regression this guards: deriving the number format from the interface
   * language. `it-CH` drops the group separator, so an Italian reader with a
   * Swiss account would see `1234.50` where every other surface shows
   * `1’234.50`. The format resolves on the currency and must keep doing so —
   * hence an English `LOCALE_ID` here with a Swiss amount coming out.
   */
  it('follows the currency, not the interface language', () => {
    // The pipe takes no `LOCALE_ID`, and that absence is the whole mechanism:
    // whichever of the eight ids `localeIdFactory` returns, the amount is
    // formatted on the currency's `numberLocale`. Injecting one here would be
    // the regression.
    const pipe = new AppCurrencyPipe();

    // The group separators below are not plain spaces: de-CH groups on U+2019
    // and fr-FR on U+202F. A failure diff between either of those and an
    // ordinary space looks like no difference at all.
    expect(pipe.transform(1234.5, 'CHF', '1.2-2')).toBe('1’234.50 CHF');
    expect(pipe.transform(1234.5, 'EUR', '1.2-2')).toBe('1 234,50 €');
  });
});
