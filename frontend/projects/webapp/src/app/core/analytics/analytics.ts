import { Injectable, inject, signal, effect, computed } from '@angular/core';
import {
  Router,
  NavigationEnd,
  type Event as RouterEvent,
} from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthApi } from '../auth/auth-api';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { runOutsideAngular } from './global-error-handler';
import { buildInfo } from '@env/build-info';

interface PageViewData {
  url: string;
  title: string;
  path: string;
  referrer?: string;
}

/**
 * Analytics service following PostHog official standards for Angular.
 * Handles automatic page view tracking and user identification.
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  readonly #router = inject(Router);
  readonly #authApi = inject(AuthApi);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);

  readonly #isTrackingActive = signal<boolean>(false);

  isActive = computed(() => {
    const isTrackingActive = this.#isTrackingActive();
    const isPostHogEnabled = this.#postHogService.isEnabled();
    const isPostHogInitialized = this.#postHogService.isInitialized();
    return isTrackingActive && isPostHogEnabled && isPostHogInitialized;
  });

  initialize(): void {
    if (!this.#postHogService.isInitialized() || this.#isTrackingActive()) {
      return;
    }
    this.#initializeTracking();
    this.#initializeUserChanges();
  }

  /**
   * Manual event tracking for custom events
   */
  trackEvent(eventName: string, properties?: Record<string, unknown>): void {
    if (
      !this.#postHogService.isEnabled() ||
      !this.#postHogService.isInitialized()
    ) {
      return;
    }

    this.#postHogService.capture(eventName, properties);
  }

  #initializeUserChanges(): void {
    effect(() => {
      const authState = this.#authApi.authState();
      if (authState.isAuthenticated && authState.user) {
        this.#identifyUser(authState.user.id);
      } else if (!authState.isAuthenticated && !authState.isLoading) {
        this.#resetUser();
      }
    });
  }

  /**
   * Initialize automatic page view tracking
   */
  #initializeTracking(): void {
    if (this.#isTrackingActive()) {
      return;
    }

    try {
      // Track route changes for page views
      this.#router.events
        .pipe(
          filter(
            (event: RouterEvent): event is NavigationEnd =>
              event instanceof NavigationEnd,
          ),
          map((event: NavigationEnd) => ({
            url: event.url,
            urlAfterRedirects: event.urlAfterRedirects,
          })),
        )
        .subscribe(({ url, urlAfterRedirects }) => {
          const pageData = this.#extractPageData(urlAfterRedirects || url);
          this.#trackPageView(pageData);
        });

      this.#isTrackingActive.set(true);
      this.#logger.info('Analytics tracking initialized');

      // Track initial page load
      const initialPageData = this.#extractPageData(this.#router.url);
      this.#trackPageView(initialPageData);
    } catch (error) {
      this.#logger.error('Failed to initialize analytics tracking', error);
    }
  }

  /**
   * Extract readable page data from URL
   */
  #extractPageData(url: string): PageViewData {
    // Remove query params and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/').filter(Boolean);

    let title = 'Page';
    let path = cleanUrl;

    // Map routes to readable titles
    if (segments.length === 0) {
      title = 'Accueil';
      path = '/';
    } else if (segments[0] === 'login') {
      title = 'Connexion';
    } else if (segments[0] === 'onboarding') {
      title = 'Configuration initiale';
      if (segments[1]) {
        const stepTitles: Record<string, string> = {
          welcome: 'Bienvenue',
          'personal-info': 'Informations personnelles',
          income: 'Revenus',
          housing: 'Logement',
          'health-insurance': 'Assurance maladie',
          'phone-plan': 'Abonnement téléphonique',
          transport: 'Transport',
          'leasing-credit': 'Leasing et crédits',
          registration: 'Création de compte',
        };
        title = `Configuration - ${stepTitles[segments[1]] || segments[1]}`;
      }
    } else if (segments[0] === 'app') {
      if (segments[1] === 'current-month') {
        title = 'Mois en cours';
      } else if (segments[1] === 'budget') {
        title = segments[2] ? 'Détail du budget' : 'Mes budgets';
      } else if (segments[1] === 'budget-templates') {
        title = segments[2] ? 'Détail du modèle' : 'Modèles de budget';
      } else {
        title = 'Dashboard';
      }
    }

    return {
      url,
      title,
      path,
      referrer: document.referrer || undefined,
    };
  }

  /**
   * Track page view following PostHog standards
   */
  #trackPageView(pageData: PageViewData): void {
    if (
      !this.#postHogService.isEnabled() ||
      !this.#postHogService.isInitialized()
    ) {
      return;
    }

    runOutsideAngular(() => {
      try {
        // Use PostHog's standard $pageview event
        this.#postHogService.capture('$pageview', {
          $current_url: pageData.url,
          $pathname: pageData.path,
          $title: pageData.title,
          ...(pageData.referrer && { $referrer: pageData.referrer }),
        });

        this.#logger.debug('Page view tracked', {
          title: pageData.title,
          path: pageData.path,
        });
      } catch (error) {
        this.#logger.error('Failed to track page view', error);
      }
    });
  }

  /**
   * Identify user following PostHog standards
   */
  #identifyUser(userId: string): void {
    if (
      !this.#postHogService.isEnabled() ||
      !this.#postHogService.isInitialized()
    ) {
      return;
    }

    runOutsideAngular(() => {
      try {
        // Use PostHog's identify method with user properties
        this.#postHogService.identify(userId, {
          // Add relevant user properties here
          platform: 'web',
          app_version: this.#getAppVersion(),
        });

        this.#logger.debug('User identified for analytics', { userId });
      } catch (error) {
        this.#logger.error('Failed to identify user', error);
      }
    });
  }

  /**
   * Reset user session following PostHog standards
   */
  #resetUser(): void {
    if (
      !this.#postHogService.isEnabled() ||
      !this.#postHogService.isInitialized()
    ) {
      return;
    }

    runOutsideAngular(() => {
      try {
        this.#postHogService.reset();
        this.#logger.debug('User session reset for analytics');
      } catch (error) {
        this.#logger.error('Failed to reset user session', error);
      }
    });
  }

  /**
   * Get app version for tracking
   */
  #getAppVersion(): string {
    return buildInfo.version || 'unknown';
  }
}
