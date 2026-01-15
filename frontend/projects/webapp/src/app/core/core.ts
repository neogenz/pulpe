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
  Injector,
  runInInjectionContext,
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
import { PostHogService } from './analytics/posthog';
import { AnalyticsService } from './analytics/analytics';
import { provideGlobalErrorHandler } from './analytics/global-error-handler';
import { buildInfo } from '@env/build-info';
import { environment } from '@env/environment';
import { Logger } from './logging/logger';
import { ROUTES } from './routing/routes-constants';

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
function logAppInfo(
  applicationConfig: ApplicationConfiguration,
  logger: Logger,
) {
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

    // PostHog Configuration (securized)
    postHogEnabled: applicationConfig.postHog().enabled,
    postHogHost: applicationConfig.postHog().host,
    postHogApiKey: applicationConfig.postHog().apiKey ? '***' : 'Non configuré',
  };

  logger.info('Pulpe Budget - Application Info', appData);
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
      withPreloading(NoPreloading),
    ),

    // Custom title strategy - APRÈS le router
    { provide: TitleStrategy, useClass: PulpeTitleStrategy },

    // HTTP Client must be provided before anything that uses it
    ...provideAuth(),

    // Global error handler with PostHog integration (needs HttpClient via PostHogService)
    provideGlobalErrorHandler(),

    // perform initialization, has to be last
    // Sequential initialization with explicit order
    provideAppInitializer(async () => {
      const applicationConfig = inject(ApplicationConfiguration);
      const postHogService = inject(PostHogService);
      const authService = inject(AuthApi);
      const analyticsService = inject(AnalyticsService);
      const injector = inject(Injector);
      const logger = inject(Logger);
      // 1. Charger la configuration d'abord
      await applicationConfig.initialize();

      // 2. Check maintenance status before proceeding
      if (!window.location.pathname.startsWith('/' + ROUTES.MAINTENANCE)) {
        try {
          const response = await fetch(
            `${applicationConfig.backendApiUrl()}/v1/maintenance/status`,
          );
          if (response.ok) {
            const data = (await response.json()) as {
              maintenanceMode: boolean;
            };
            if (data.maintenanceMode) {
              logger.info(
                'Maintenance mode detected at startup, redirecting...',
              );
              window.location.href = '/' + ROUTES.MAINTENANCE;
              return;
            }
          }
        } catch {
          logger.warn(
            'Failed to check maintenance status, continuing normally',
          );
        }
      }

      // 3. Logger les informations complètes après chargement
      logAppInfo(applicationConfig, logger);

      try {
        // 4. Initialiser PostHog (non-blocking, can fail gracefully)
        try {
          await postHogService.initialize();

          // Initialize analytics with proper injection context for effect()
          runInInjectionContext(injector, () => {
            analyticsService.initializeAnalyticsTracking();
            logger.debug('Analytics service ready', {
              isActive: analyticsService.isActive(),
            });
          });
        } catch (postHogError) {
          if (applicationConfig.isDevelopment()) {
            logger.error('PostHog initialization failed', postHogError);
            throw postHogError;
          }

          logger.warn(
            'PostHog initialization failed, continuing without analytics',
            postHogError,
          );
          // Don't throw - PostHog failure shouldn't block app startup
        }

        // 5. Initialiser l'auth ensuite (config garantie disponible)
        await authService.initializeAuthState();
      } catch (error) {
        logger.error("Erreur lors de l'initialisation", error);
        throw error; // Bloquer le démarrage de l'app en cas d'erreur critique
      }
    }),

    ...provideLocale(),
    ...provideAngularMaterial(),
    ...provideLottie(),
  ];
}
