import {
  type Routes,
  provideRouter,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withRouterConfig,
  withPreloading,
  NoPreloading,
  TitleStrategy,
} from '@angular/router';

import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
  ErrorHandler,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideLottieOptions,
  provideCacheableAnimationLoader,
} from 'ngx-lottie';
import { provideLocale } from './locale';
import { provideAngularMaterial } from './angular-material';
import { provideAuth } from './auth/auth-providers';
import { AuthApi } from './auth/auth-api';
import { PulpeTitleStrategy } from './routing/title-strategy';
import { ApplicationConfiguration } from './config/application-configuration';
import { environment } from '@env/environment';
import { buildInfo } from '@env/build-info';
import { AppErrorHandler } from './error';
import { errorInterceptor } from './http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PostHogService } from './analytics';

export interface CoreOptions {
  routes: Routes; // possible to extend options with more props in the future
}

function provideLottie() {
  return [
    provideLottieOptions({
      player: () => import('lottie-web'),
    }),
    provideCacheableAnimationLoader(),
  ];
}

/**
 * Logger unifié pour les informations de build et configuration
 * Utilise le service Logger pour un logging approprié selon l'environnement
 */
function logAppInfo(applicationConfig: ApplicationConfiguration) {
  const appData = {
    // Build Info
    version: buildInfo.version,
    commitHash: buildInfo.commitHash,
    buildDate: buildInfo.buildDate,
    buildTimestamp: buildInfo.buildTimestamp,

    // Environment
    environment:
      applicationConfig.environment() ||
      (environment.production ? 'production' : 'development'),

    // Configuration - Données sécurisées pour production
    supabaseUrl: applicationConfig.supabaseUrl(),
    supabaseAnonKey: applicationConfig.supabaseAnonKey()
      ? '***'
      : 'Non configuré',
    backendApiUrl: applicationConfig.backendApiUrl(),
  };

  console.log('Pulpe Budget - Application Info', appData);
}

export function provideCore({ routes }: CoreOptions) {
  return [
    // zoneless change detection for better performance
    provideZonelessChangeDetection(),

    // HTTP client with error interceptor
    provideHttpClient(withInterceptors([errorInterceptor])),

    // Custom error handler - must be before global listeners
    { provide: ErrorHandler, useClass: AppErrorHandler },

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
      withPreloading(NoPreloading),
    ),

    // Custom title strategy - APRÈS le router
    { provide: TitleStrategy, useClass: PulpeTitleStrategy },

    // perform initialization, has to be last
    // Sequential initialization with explicit order
    provideAppInitializer(async () => {
      const applicationConfig = inject(ApplicationConfiguration);
      const authService = inject(AuthApi);
      const posthog = inject(PostHogService);

      try {
        // 1. Critical: Load configuration first
        await applicationConfig.initialize();

        // 2. Logger les informations complètes après chargement
        logAppInfo(applicationConfig);

        // 3. Critical: Initialize auth (config guaranteed available)
        await authService.initializeAuthState();

        // 4. Non-critical: Initialize PostHog analytics (fire-and-forget)
        // Won't block app startup even if it fails
        posthog.initialize().catch((error) => {
          console.debug('PostHog initialization skipped', error);
          // Already handled internally, just ensuring no unhandled rejection
        });
      } catch (error) {
        // Only throw for critical failures (config or auth)
        console.error("Erreur critique lors de l'initialisation", error);
        throw error;
      }
    }),

    ...provideLocale(),
    ...provideAngularMaterial(),
    ...provideLottie(),

    ...provideAuth(),
  ];
}
