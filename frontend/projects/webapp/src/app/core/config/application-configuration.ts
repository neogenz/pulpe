import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '../logging/logger';
import {
  type ApplicationConfig,
  type ConfigFile,
  ConfigSchema,
  formatConfigError,
} from './config.schema';

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
  readonly environment = signal<
    'development' | 'production' | 'test' | 'local'
  >('development');

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
    host: 'https://eu.i.posthog.com',
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

  // Turnstile configuration
  readonly turnstile = signal<{
    siteKey: string;
  }>({
    siteKey: '',
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

    const turnstileConfig = this.turnstile();
    const config: ApplicationConfig = {
      supabase: { url, anonKey: key },
      backend: { apiUrl },
      turnstile: { siteKey: turnstileConfig.siteKey },
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

      // Runtime validation is critical: config.json could be corrupted,
      // manually edited, or tampered with. ConfigSchema ensures integrity.
      const validationResult = ConfigSchema.safeParse(configData);

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

    try {
      return await firstValueFrom(
        this.#http.get<ConfigFile>('/config.json', { headers }),
      );
    } catch (error: unknown) {
      this.#logger.error('Error loading config.json', error);
      this.#logger.error('❌ CRITICAL: config.json not found or invalid');
      this.#logger.error('📍 Attempted to load from: /config.json');
      this.#logger.error('💡 Fix: Run "npm run generate:config" to create it');

      // En développement et production, config.json est requis
      // Plus de fallback - l'application doit échouer si pas de config

      // En production, fail fast
      throw new Error('config.json is required. Run: npm run generate:config', {
        cause: error,
      });
    }
  }

  /**
   * Applique la configuration validée aux signaux
   */
  #applyConfiguration(config: ApplicationConfig): void {
    // Set core configuration
    this.supabaseUrl.set(config.supabase.url);
    this.supabaseAnonKey.set(config.supabase.anonKey);
    this.backendApiUrl.set(config.backend.apiUrl);
    this.environment.set(config.environment);

    // Set Turnstile configuration
    this.turnstile.set({
      siteKey: config.turnstile.siteKey,
    });

    // Set PostHog configuration if provided
    if (!config.postHog) {
      this.#logger.info('PostHog configuration not provided, using defaults');
      return;
    }

    // Set PostHog configuration as a single update
    this.postHog.set({
      apiKey: config.postHog.apiKey,
      host: config.postHog.host,
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
      host: config.postHog.host,
      debug: config.postHog.debug,
    });
  }
}
