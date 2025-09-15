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

  // PostHog configuration signals
  readonly postHogApiKey = signal<string>('');
  readonly postHogHost = signal<string>('https://eu.posthog.com');
  readonly postHogEnabled = signal<boolean>(false);
  readonly postHogCapturePageviews = signal<boolean>(true);
  readonly postHogCapturePageleaves = signal<boolean>(true);
  readonly postHogSessionRecordingEnabled = signal<boolean>(false);
  readonly postHogSessionRecordingMaskInputs = signal<boolean>(true);
  readonly postHogSessionRecordingSampleRate = signal<number>(0.1);
  readonly postHogDebug = signal<boolean>(false);

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
    if (this.postHogApiKey()) {
      config.postHog = {
        apiKey: this.postHogApiKey(),
        host: this.postHogHost(),
        enabled: this.postHogEnabled(),
        capturePageviews: this.postHogCapturePageviews(),
        capturePageleaves: this.postHogCapturePageleaves(),
        sessionRecording: {
          enabled: this.postHogSessionRecordingEnabled(),
          maskInputs: this.postHogSessionRecordingMaskInputs(),
          sampleRate: this.postHogSessionRecordingSampleRate(),
        },
        debug: this.postHogDebug(),
      };
    }

    return config;
  });

  // Signaux dérivés (computed)
  readonly isDevelopment = computed(() => this.environment() === 'development');
  readonly isProduction = computed(() => this.environment() === 'production');
  readonly isLocal = computed(() => this.environment() === 'local');

  // PostHog specific computed signals
  readonly postHogConfig = computed(() => {
    const apiKey = this.postHogApiKey();

    // Return null if PostHog is not configured
    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      host: this.postHogHost(),
      enabled: this.postHogEnabled(),
      capturePageviews: this.postHogCapturePageviews(),
      capturePageleaves: this.postHogCapturePageleaves(),
      sessionRecording: {
        enabled: this.postHogSessionRecordingEnabled(),
        maskInputs: this.postHogSessionRecordingMaskInputs(),
        sampleRate: this.postHogSessionRecordingSampleRate(),
      },
      debug: this.postHogDebug() || this.isDevelopment(),
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

    this.postHogApiKey.set(config.postHog.apiKey);
    this.postHogHost.set(postHogHost);
    this.postHogEnabled.set(config.postHog.enabled);
    this.postHogCapturePageviews.set(config.postHog.capturePageviews);
    this.postHogCapturePageleaves.set(config.postHog.capturePageleaves);
    this.postHogDebug.set(config.postHog.debug);

    // Set session recording configuration
    if (config.postHog.sessionRecording) {
      this.postHogSessionRecordingEnabled.set(
        config.postHog.sessionRecording.enabled,
      );
      this.postHogSessionRecordingMaskInputs.set(
        config.postHog.sessionRecording.maskInputs,
      );
      this.postHogSessionRecordingSampleRate.set(
        config.postHog.sessionRecording.sampleRate,
      );
    }

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
      this.postHogApiKey.set(DEFAULT_CONFIG.postHog.apiKey);
      this.postHogHost.set(DEFAULT_CONFIG.postHog.host);
      this.postHogEnabled.set(DEFAULT_CONFIG.postHog.enabled);
      this.postHogCapturePageviews.set(DEFAULT_CONFIG.postHog.capturePageviews);
      this.postHogCapturePageleaves.set(
        DEFAULT_CONFIG.postHog.capturePageleaves,
      );
      this.postHogDebug.set(DEFAULT_CONFIG.postHog.debug);

      if (DEFAULT_CONFIG.postHog.sessionRecording) {
        this.postHogSessionRecordingEnabled.set(
          DEFAULT_CONFIG.postHog.sessionRecording.enabled,
        );
        this.postHogSessionRecordingMaskInputs.set(
          DEFAULT_CONFIG.postHog.sessionRecording.maskInputs,
        );
        this.postHogSessionRecordingSampleRate.set(
          DEFAULT_CONFIG.postHog.sessionRecording.sampleRate,
        );
      }
    }
  }
}
