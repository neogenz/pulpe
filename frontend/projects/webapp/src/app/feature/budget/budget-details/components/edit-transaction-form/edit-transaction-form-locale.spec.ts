import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditTransactionForm } from './edit-transaction-form';
import { provideLocale } from '@core/locale';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type { SupportedCurrency } from 'pulpe-shared';

/**
 * Deterministic regression spec for the datepicker locale bug (PUL-100).
 *
 * Root cause: `MatNativeDateModule` in the component's standalone `imports[]`
 * registered `NativeDateAdapter` + `MAT_NATIVE_DATE_FORMATS` into the
 * COMPONENT injector, shadowing the app-level `DateFnsAdapter` +
 * `CUSTOM_DATE_FORMATS` ('P' token) from `provideLocale()`. The
 * `NativeDateAdapter` received a date-fns locale object (frCH/fr) as
 * `MAT_DATE_LOCALE`, which is not a BCP-47 string, so `Intl.DateTimeFormat`
 * fell back to en-US → `3/28/2026`.
 *
 * Why we resolve from the COMPONENT injector (not TestBed root): in a TestBed,
 * `provideLocale()` lives in the environment injector, so `TestBed.inject(...)`
 * always returns the date-fns adapter regardless of the bug. The datepicker
 * inside the component resolves its adapter from the component injector, where
 * `MatNativeDateModule` (when present) shadows the app adapter. Resolving via
 * `fixture.debugElement.injector` mirrors the production resolution exactly, so
 * this test FAILS on the buggy code (`3/28/2026`) and PASSES after the fix.
 */
const FIXED_DATE = new Date(2026, 2, 28); // 2026-03-28 (month is 0-indexed)

function makeStorageServiceMock(
  currency: SupportedCurrency,
): Partial<StorageService> {
  return {
    get: (key: string) =>
      key === STORAGE_KEYS.SETTINGS_CURRENCY
        ? (currency as unknown as null)
        : null,
    getString: () => null,
    set: vi.fn(),
    setString: vi.fn(),
    remove: vi.fn(),
  };
}

function baseProviders(currency: SupportedCurrency) {
  return [
    provideZonelessChangeDetection(),
    ...provideTranslocoForTest(),
    provideAnimationsAsync(),
    ...provideLocale(),
    { provide: StorageService, useValue: makeStorageServiceMock(currency) },
    {
      provide: FeatureFlagsService,
      useValue: { isMultiCurrencyEnabled: signal(false) },
    },
    {
      provide: UserSettingsStore,
      useValue: {
        currency: signal<SupportedCurrency>(currency),
        showCurrencySelector: signal(false),
      },
    },
    {
      provide: CurrencyConverterService,
      useValue: {
        convertWithMetadata: () =>
          Promise.resolve({ convertedAmount: 0, metadata: null }),
      },
    },
    {
      provide: Logger,
      useValue: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  ];
}

function formatDateThroughComponentDatepicker(): string {
  const fixture = TestBed.createComponent(EditTransactionForm);

  // Resolve the adapter + formats the way the component's own datepicker does,
  // from the component injector — NOT TestBed root.
  const adapter = fixture.debugElement.injector.get(DateAdapter);
  const formats = fixture.debugElement.injector.get(MAT_DATE_FORMATS);

  return adapter.format(FIXED_DATE, formats.display.dateInput);
}

describe('EditTransactionForm — datepicker locale format', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should display 2026-03-28 as 28.03.2026 for a CHF user (fr-CH)', async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransactionForm],
      providers: baseProviders('CHF'),
    }).compileComponents();

    expect(formatDateThroughComponentDatepicker()).toBe('28.03.2026');
  });

  it('should display 2026-03-28 as 28/03/2026 for an EUR user (fr-FR)', async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransactionForm],
      providers: baseProviders('EUR'),
    }).compileComponents();

    expect(formatDateThroughComponentDatepicker()).toBe('28/03/2026');
  });
});
