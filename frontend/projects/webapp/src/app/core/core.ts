import {
  type Routes,
  provideRouter,
  withComponentInputBinding,
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
import { AuthSessionService } from './auth/auth-session.service';
import { PulpeTitleStrategy } from './routing/title-strategy';
import { ApplicationConfiguration } from './config/application-configuration';
import { PostHogService } from './analytics/posthog';
import { AnalyticsService } from './analytics/analytics';
import { provideGlobalErrorHandler } from './analytics/global-error-handler';
import { buildInfo } from '@env/build-info';
import { environment } from '@env/environment';
import { Logger } from './logging/logger';
import { StorageMigrationRunnerService } from './storage/storage-migration-runner.service';
import { provideSplashRemoval } from './splash-removal';
import { ClientKeyService } from './encryption/client-key.service';
import { PreloadService } from './preload/preload.service';

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
      withRouterConfig({
        onSameUrlNavigation: 'reload',
        urlUpdateStrategy: 'eager',
        canceledNavigationResolution: 'computed',
      }),
      withComponentInputBinding(),
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

    // Remove splash screen once first navigation completes (or after timeout)
    provideSplashRemoval(),

    // perform initialization, has to be last
    // Sequential initialization with explicit order
    provideAppInitializer(async () => {
      const applicationConfig = inject(ApplicationConfiguration);
      const postHogService = inject(PostHogService);
      const authSession = inject(AuthSessionService);
      const analyticsService = inject(AnalyticsService);
      const storageMigrationRunner = inject(StorageMigrationRunnerService);
      const clientKeyService = inject(ClientKeyService);
      const injector = inject(Injector);
      const logger = inject(Logger);

      // 0. Run storage migrations first (before any data is read)
      storageMigrationRunner.runMigrations();

      // 0b. Restore client encryption key from sessionStorage (if available)
      clientKeyService.initialize();

      // 1. Charger la configuration d'abord (requise par PostHog et Auth)
      await applicationConfig.initialize();

      // 2. Logger les informations complètes après chargement
      logAppInfo(applicationConfig, logger);

      // 3. Initialiser PostHog et Auth en parallèle (les deux ne dépendent que de la config)
      const initPostHog = async () => {
        try {
          await postHogService.initialize();
          runInInjectionContext(injector, () => {
            analyticsService.initializeAnalyticsTracking();
            logger.debug('Analytics service ready', {
              isActive: analyticsService.isActive(),
            });
          });
        } catch (postHogError) {
          if (applicationConfig.isDevelopment()) {
            throw postHogError;
          }
          logger.warn(
            'PostHog initialization failed, continuing without analytics',
            postHogError,
          );
        }
      };

      try {
        await Promise.all([initPostHog(), authSession.initializeAuthState()]);
      } catch (error) {
        logger.error("Erreur lors de l'initialisation", error);
        throw error;
      }

      // Force instantiation — effect() inside will preload data when authenticated
      inject(PreloadService);
    }),

    ...provideLocale(),
    ...provideAngularMaterial(),
    ...provideLottie(),
  ];
}
