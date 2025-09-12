import { registerLocaleData } from '@angular/common';
import localeFrCHExtra from '@angular/common/locales/extra/fr-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import localeDeCHExtra from '@angular/common/locales/extra/de-CH';
import localeDeCH from '@angular/common/locales/de-CH';
import { LOCALE_ID } from '@angular/core';
import {
  MAT_DATE_FNS_FORMATS,
  provideDateFnsAdapter,
} from '@angular/material-date-fns-adapter';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { frCH } from 'date-fns/locale';

registerLocaleData(localeFrCH, 'fr-CH', localeFrCHExtra);
// Used to format correctly the amount as currency (XX'XXX.xx)
registerLocaleData(localeDeCH, 'de-CH', localeDeCHExtra);
// Format de date étendu pour prendre en charge le timepicker et month/year picker
const CUSTOM_DATE_FORMATS = {
  ...MAT_DATE_FNS_FORMATS,
  parse: {
    ...MAT_DATE_FNS_FORMATS.parse,
    dateInput: ['dd.MM.yyyy', 'MM.yyyy'], // Support both date and month/year
    timeInput: 'HH:mm', // Format pour parser l'heure
  },
  display: {
    ...MAT_DATE_FNS_FORMATS.display,
    dateInput: 'dd.MM.yyyy', // Format par défaut
    monthYearLabel: 'MMM yyyy', // Format pour month/year picker
    timeInput: 'HH:mm', // Format pour afficher l'heure dans l'input
    timeOptionLabel: 'HH:mm', // Format pour afficher les options d'heure
  },
};

export function provideLocale() {
  return [
    { provide: LOCALE_ID, useValue: 'fr-CH' },
    { provide: MAT_DATE_LOCALE, useValue: frCH },
    provideDateFnsAdapter(),
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS },
  ];
}
