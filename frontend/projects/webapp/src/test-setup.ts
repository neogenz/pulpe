import { getTestBed } from '@angular/core/testing';
// @ts-expect-error - These imports are deprecated in Angular 20 but still needed for test setup
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize Angular testing environment for Vitest
// Angular v20 modern setup without zone.js (zoneless)
// TODO: Update to new Angular 20 testing API when available
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
    teardown: { destroyAfterEach: true }, // Enable teardown for zoneless
  },
);
