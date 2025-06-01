import {
  Routes,
  provideRouter,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';

import {
  provideAppInitializer,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

export interface CoreOptions {
  routes: Routes; // possible to extend options with more props in the future
}

export function provideCore({ routes }: CoreOptions) {
  return [
    // zoneless change detection for better performance
    provideZonelessChangeDetection(),

    // global error handling for zoneless apps
    provideBrowserGlobalErrorListeners(),

    // reasonable default for most applications
    provideAnimationsAsync(),

    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
      withComponentInputBinding(),
      withEnabledBlockingInitialNavigation(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),

    // other 3rd party libraries providers like NgRx, provideStore()

    // other application specific providers and setup

    // perform initialization, has to be last
    provideAppInitializer(() => {
      // ...
    }),
    {
      provide: MAT_ICON_DEFAULT_OPTIONS,
      useValue: {
        fontSet: 'material-symbols-outlined',
      },
    },
  ];
}
