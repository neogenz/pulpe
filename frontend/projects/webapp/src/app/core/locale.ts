import { registerLocaleData } from '@angular/common';
import localeFrCHExtra from '@angular/common/locales/extra/fr-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import localeDeCHExtra from '@angular/common/locales/extra/de-CH';
import localeDeCH from '@angular/common/locales/de-CH';
import localeFRExtra from '@angular/common/locales/extra/fr';
import localeFR from '@angular/common/locales/fr';
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
import { fr, frCH } from 'date-fns/locale';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';
import { StorageService } from './storage/storage.service';
import { readPersistedCurrency, UserSettingsStore } from './user-settings';

registerLocaleData(localeFrCH, 'fr-CH', localeFrCHExtra);
// Used to format correctly the amount as currency (XX'XXX.xx)
registerLocaleData(localeDeCH, 'de-CH', localeDeCHExtra);
registerLocaleData(localeFR, 'fr-FR', localeFRExtra);

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
    dateInput: 'P', // Format localisé selon la devise (fr-CH / fr-FR)
    monthYearLabel: 'MMM yyyy', // Format pour month/year picker
    timeInput: 'HH:mm', // Format pour afficher l'heure dans l'input
    timeOptionLabel: 'HH:mm', // Format pour afficher les options d'heure
  },
};

export function localeIdFactory(): string {
  const storage = inject(StorageService);
  const currency = readPersistedCurrency(storage);
  return CURRENCY_METADATA[currency].locale;
}

function dateFnsLocaleFor(currency: SupportedCurrency) {
  return currency === 'CHF' ? frCH : fr;
}

export function provideLocale() {
  return [
    { provide: LOCALE_ID, useFactory: localeIdFactory },
    {
      provide: MAT_DATE_LOCALE,
      useFactory: () =>
        dateFnsLocaleFor(readPersistedCurrency(inject(StorageService))),
    },
    provideDateFnsAdapter(),
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS },
    provideEnvironmentInitializer(() => {
      const dateAdapter = inject(DateAdapter);
      const userSettings = inject(UserSettingsStore);
      effect(() => {
        dateAdapter.setLocale(dateFnsLocaleFor(userSettings.currency()));
      });
    }),
  ];
}
