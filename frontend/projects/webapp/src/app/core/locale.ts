import { registerLocaleData } from '@angular/common';
import localeDeCHExtra from '@angular/common/locales/extra/de-CH';
import localeDeCH from '@angular/common/locales/de-CH';
import localeDeExtra from '@angular/common/locales/extra/de';
import localeDe from '@angular/common/locales/de';
import localeEnCHExtra from '@angular/common/locales/extra/en-CH';
import localeEnCH from '@angular/common/locales/en-CH';
import localeEnGBExtra from '@angular/common/locales/extra/en-GB';
import localeEnGB from '@angular/common/locales/en-GB';
import localeFrCHExtra from '@angular/common/locales/extra/fr-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import localeFRExtra from '@angular/common/locales/extra/fr';
import localeFR from '@angular/common/locales/fr';
import localeItCHExtra from '@angular/common/locales/extra/it-CH';
import localeItCH from '@angular/common/locales/it-CH';
import localeItExtra from '@angular/common/locales/extra/it';
import localeIt from '@angular/common/locales/it';
import {
  effect,
  inject,
  LOCALE_ID,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import {
  MAT_DATE_FNS_FORMATS,
  provideDateFnsAdapter,
} from '@angular/material-date-fns-adapter';
import { de, enGB, fr, frCH, it } from 'date-fns/locale';
import type { SupportedCurrency, SupportedLocale } from 'pulpe-shared';
import { resolveStartupLanguage } from './i18n/language-resolver';
import { StorageService } from './storage/storage.service';
import { readPersistedCurrency, UserSettingsStore } from './user-settings';

// Every locale the language × currency table below can produce. An unregistered
// `LOCALE_ID` makes `DatePipe` and `DecimalPipe` throw `Missing locale data` at
// runtime, so the two lists have to stay in step.
registerLocaleData(localeFrCH, 'fr-CH', localeFrCHExtra);
registerLocaleData(localeEnCH, 'en-CH', localeEnCHExtra);
registerLocaleData(localeDeCH, 'de-CH', localeDeCHExtra);
registerLocaleData(localeItCH, 'it-CH', localeItCHExtra);
registerLocaleData(localeFR, 'fr-FR', localeFRExtra);
registerLocaleData(localeEnGB, 'en-GB', localeEnGBExtra);
registerLocaleData(localeDe, 'de-DE', localeDeExtra);
registerLocaleData(localeIt, 'it-IT', localeItExtra);

/**
 * The interface language carries the words; the currency carries the region.
 * Keeping them on two axes is what lets someone read Pulpe in English while
 * their amounts stay Swiss.
 *
 * This does *not* drive the amount format — that resolves on
 * `CURRENCY_METADATA[currency].numberLocale` and must keep doing so. What
 * `LOCALE_ID` drives here is dates, ordinals and plain numbers.
 */
const LOCALE_ID_BY_LANGUAGE: Record<
  SupportedCurrency,
  Record<SupportedLocale, string>
> = {
  CHF: { fr: 'fr-CH', en: 'en-CH', de: 'de-CH', it: 'it-CH' },
  EUR: { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', it: 'it-IT' },
};

// Formats étendus pour le timepicker et month/year picker.
// `'P'` est le token date-fns localisé : fr-CH → dd.MM.yyyy, fr-FR → dd/MM/yyyy.
const CUSTOM_DATE_FORMATS = {
  ...MAT_DATE_FNS_FORMATS,
  parse: {
    ...MAT_DATE_FNS_FORMATS.parse,
    dateInput: ['P', 'dd.MM.yyyy', 'dd/MM/yyyy', 'MM.yyyy', 'MM/yyyy'],
    timeInput: 'HH:mm', // Format pour parser l'heure
  },
  display: {
    ...MAT_DATE_FNS_FORMATS.display,
    dateInput: 'P', // Format localisé selon la langue et la devise
    monthYearLabel: 'MMM yyyy', // Format pour month/year picker
    timeInput: 'HH:mm', // Format pour afficher l'heure dans l'input
    timeOptionLabel: 'HH:mm', // Format pour afficher les options d'heure
  },
};

export function localeIdFor(
  language: SupportedLocale,
  currency: SupportedCurrency,
): string {
  return LOCALE_ID_BY_LANGUAGE[currency][language];
}

export function localeIdFactory(): string {
  const storage = inject(StorageService);
  return localeIdFor(
    resolveStartupLanguage(storage),
    readPersistedCurrency(storage),
  );
}

/**
 * date-fns publishes a Swiss variant for French only. English, German and
 * Italian therefore keep their base locale under CHF — nobody needs to go
 * looking for `deCH`, it does not exist.
 */
export function dateFnsLocaleFor(
  language: SupportedLocale,
  currency: SupportedCurrency,
) {
  switch (language) {
    case 'fr':
      return currency === 'CHF' ? frCH : fr;
    case 'en':
      return enGB;
    case 'de':
      return de;
    case 'it':
      return it;
  }
}

export function provideLocale() {
  return [
    { provide: LOCALE_ID, useFactory: localeIdFactory },
    {
      provide: MAT_DATE_LOCALE,
      useFactory: () => {
        const storage = inject(StorageService);
        return dateFnsLocaleFor(
          resolveStartupLanguage(storage),
          readPersistedCurrency(storage),
        );
      },
    },
    provideDateFnsAdapter(),
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS },
    provideEnvironmentInitializer(() => {
      const dateAdapter = inject(DateAdapter);
      const userSettings = inject(UserSettingsStore);
      effect(() => {
        dateAdapter.setLocale(
          dateFnsLocaleFor(userSettings.locale(), userSettings.currency()),
        );
      });
    }),
  ];
}
