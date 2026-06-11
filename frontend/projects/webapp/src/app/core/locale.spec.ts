import {
  EnvironmentInjector,
  provideZonelessChangeDetection,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { localeIdFactory } from './locale';
import { STORAGE_KEYS } from './storage/storage-keys';
import { StorageService } from './storage/storage.service';

function configureWithPersistedCurrency(persisted: string | null): void {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: StorageService,
        useValue: {
          getString: (key: string) =>
            key === STORAGE_KEYS.SETTINGS_CURRENCY ? persisted : null,
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
  it('returns fr-CH when CHF is persisted', () => {
    configureWithPersistedCurrency('CHF');
    expect(resolveLocale()).toBe('fr-CH');
  });

  it('returns fr-FR when EUR is persisted', () => {
    configureWithPersistedCurrency('EUR');
    expect(resolveLocale()).toBe('fr-FR');
  });

  it('defaults to fr-CH when no currency is persisted', () => {
    configureWithPersistedCurrency(null);
    expect(resolveLocale()).toBe('fr-CH');
  });

  it('defaults to fr-CH when the persisted value is invalid', () => {
    configureWithPersistedCurrency('USD');
    expect(resolveLocale()).toBe('fr-CH');
  });
});
