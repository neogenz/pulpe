import {
  Routes,
  provideRouter,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';

import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideLocale } from './locale';
import { provideAngularMaterial } from './angular-material';
import { provideAuth } from './auth/auth-providers';
import { AuthApi } from './auth/auth-api';
import { provideHttpClient } from '@angular/common/http';
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
    // perform initialization, has to be last
    provideAppInitializer(() => {
      const authService = inject(AuthApi);
      return authService.initializeAuthState();
    }),
    provideHttpClient(),

    ...provideLocale(),
    ...provideAngularMaterial(),

    ...provideAuth(),
  ];
}
