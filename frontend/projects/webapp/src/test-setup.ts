import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { registerLocaleData } from '@angular/common';
import localeDeChFr from '@angular/common/locales/fr-CH';

// Register Swiss French locale for CurrencyPipe in tests
registerLocaleData(localeDeChFr, 'fr-CH');

// Initialize Angular testing environment for Vitest
// Angular v20 modern setup without zone.js (zoneless)
// Using platformBrowserTesting for proper signal inputs support
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
    teardown: { destroyAfterEach: true }, // Enable teardown for zoneless
  },
);
