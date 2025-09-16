import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  type ApplicationConfig,
  type ConfigFile,
  safeValidateConfig,
  DEFAULT_CONFIG,
  formatConfigError,
} from './config.schema';
import { isValidUrl, sanitizeUrl } from '../utils/validators';
import { Logger } from '../logging/logger';

@Injectable({
  providedIn: 'root',
})
export class ApplicationConfiguration {
  readonly #http = inject(HttpClient);
  readonly #logger = inject(Logger);

  // Signaux de configuration
  readonly supabaseUrl = signal<string>('');
  readonly supabaseAnonKey = signal<string>('');
  readonly backendApiUrl = signal<string>('');
  readonly environment = signal<'development' | 'production' | 'local'>(
    'development',
  );

  // PostHog configuration as a single signal object
  readonly postHog = signal<{
    apiKey: string;
    host: string;
    enabled: boolean;
    capturePageviews: boolean;
    capturePageleaves: boolean;
    sessionRecording: {
      enabled: boolean;
      maskInputs: boolean;
      sampleRate: number;
    };
    debug: boolean;
  }>({
    apiKey: '',
    host: 'https://eu.posthog.com',
    enabled: false,
    capturePageviews: true,
    capturePageleaves: true,
    sessionRecording: {
      enabled: false,
      maskInputs: true,
      sampleRate: 0.1,
    },
    debug: false,
  });

  // Configuration complète en lecture seule
  readonly rawConfiguration = computed<ApplicationConfig | null>(() => {
    const url = this.supabaseUrl();
    const key = this.supabaseAnonKey();
    const apiUrl = this.backendApiUrl();
    const env = this.environment();

    // Retourne null si pas encore configuré
    if (!url || !key || !apiUrl) {
      return null;
    }

    const config: ApplicationConfig = {
      supabase: { url, anonKey: key },
      backend: { apiUrl },
      environment: env,
    };

    // Add PostHog configuration if API key is provided
    const postHogConfig = this.postHog();
    if (postHogConfig.apiKey) {
      config.postHog = postHogConfig;
    }

    return config;
  });

  // Signaux dérivés (computed)
  readonly isDevelopment = computed(() => this.environment() === 'development');
  readonly isProduction = computed(() => this.environment() === 'production');
  readonly isLocal = computed(() => this.environment() === 'local');

  // PostHog specific computed signals
  readonly postHogConfig = computed(() => {
    const config = this.postHog();

    // Return null if PostHog is not configured
    if (!config.apiKey) {
      return null;
    }

    return {
      ...config,
      debug: config.debug || this.isDevelopment(),
    };
  });

  /**
   * Initialise la configuration en chargeant le fichier config.json
   */
  async initialize(): Promise<void> {
    try {
      const configData = await this.#loadConfigFile();
      const validationResult = safeValidateConfig(configData);

      if (!validationResult.success) {
        const errorMessage = formatConfigError(validationResult.error);
        this.#logger.error('Configuration validation failed', errorMessage);
        throw new Error(errorMessage);
      }

      this.#applyConfiguration(validationResult.data);
      this.#logger.info('Configuration loaded and validated successfully');
    } catch (error) {
      this.#logger.error(
        'Erreur lors du chargement de la configuration',
        error,
      );
      this.#setDefaults();
      throw error;
    }
  }

  /**
   * Recharge la configuration
   */
  async refresh(): Promise<void> {
    await this.initialize();
  }

  /**
   * Charge le fichier de configuration depuis /config.json
   */
  async #loadConfigFile(): Promise<ConfigFile> {
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    });
    return firstValueFrom(
      this.#http.get<ConfigFile>('/config.json', { headers }),
    );
  }

  /**
   * Applique la configuration validée aux signaux
   */
  #applyConfiguration(config: ApplicationConfig): void {
    // Validate and sanitize URLs before setting
    const supabaseUrl = sanitizeUrl(
      config.supabase.url,
      'http://localhost:54321',
    );
    const backendApiUrl = sanitizeUrl(
      config.backend.apiUrl,
      'http://localhost:3000/api/v1',
    );

    // Log validation results in development
    if (!isValidUrl(config.supabase.url)) {
      this.#logger.warn('Invalid Supabase URL, using sanitized fallback', {
        original: config.supabase.url,
        sanitized: supabaseUrl,
      });
    }

    if (!isValidUrl(config.backend.apiUrl)) {
      this.#logger.warn('Invalid Backend API URL, using sanitized fallback', {
        original: config.backend.apiUrl,
        sanitized: backendApiUrl,
      });
    }

    // Set core configuration
    this.supabaseUrl.set(supabaseUrl);
    this.supabaseAnonKey.set(config.supabase.anonKey);
    this.backendApiUrl.set(backendApiUrl);
    this.environment.set(config.environment);

    // Set PostHog configuration if provided
    if (!config.postHog) {
      this.#logger.info('PostHog configuration not provided, using defaults');
      return;
    }

    const postHogHost = sanitizeUrl(
      config.postHog.host,
      'https://eu.posthog.com',
    );

    if (!isValidUrl(config.postHog.host)) {
      this.#logger.warn('Invalid PostHog host URL, using sanitized fallback', {
        original: config.postHog.host,
        sanitized: postHogHost,
      });
    }

    // Set PostHog configuration as a single update
    this.postHog.set({
      apiKey: config.postHog.apiKey,
      host: postHogHost,
      enabled: config.postHog.enabled,
      capturePageviews: config.postHog.capturePageviews,
      capturePageleaves: config.postHog.capturePageleaves,
      sessionRecording: config.postHog.sessionRecording || {
        enabled: false,
        maskInputs: true,
        sampleRate: 0.1,
      },
      debug: config.postHog.debug,
    });

    this.#logger.info('PostHog configuration loaded', {
      enabled: config.postHog.enabled,
      host: postHogHost,
      debug: config.postHog.debug,
    });
  }

  /**
   * Définit les valeurs par défaut en cas d'erreur
   */
  #setDefaults(): void {
    this.#logger.warn('Using default configuration as fallback');
    this.supabaseUrl.set(DEFAULT_CONFIG.supabase.url);
    this.supabaseAnonKey.set(DEFAULT_CONFIG.supabase.anonKey);
    this.backendApiUrl.set(DEFAULT_CONFIG.backend.apiUrl);
    this.environment.set(DEFAULT_CONFIG.environment);

    // Set PostHog defaults
    if (DEFAULT_CONFIG.postHog) {
      this.postHog.set({
        apiKey: DEFAULT_CONFIG.postHog.apiKey,
        host: DEFAULT_CONFIG.postHog.host,
        enabled: DEFAULT_CONFIG.postHog.enabled,
        capturePageviews: DEFAULT_CONFIG.postHog.capturePageviews,
        capturePageleaves: DEFAULT_CONFIG.postHog.capturePageleaves,
        sessionRecording: DEFAULT_CONFIG.postHog.sessionRecording || {
          enabled: false,
          maskInputs: true,
          sampleRate: 0.1,
        },
        debug: DEFAULT_CONFIG.postHog.debug,
      });
    }
  }
}
