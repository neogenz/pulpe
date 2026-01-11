import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCh from '@angular/common/locales/fr-CH';

// Register Swiss French locale for CurrencyPipe in tests
registerLocaleData(localeFrCh, 'fr-CH');

// Initialize Angular testing environment for Vitest
// Angular v20 modern setup without zone.js (zoneless)
// Using platformBrowserTesting for proper signal inputs support
// Note: errorOnUnknownProperties disabled due to JIT compilation issues with signal inputs
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: false,
    teardown: { destroyAfterEach: true },
  },
);
