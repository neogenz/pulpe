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
  readonly posthogApiKey = signal<string | undefined>(undefined);
  readonly posthogApiHost = signal<string>('https://app.posthog.com');
  readonly posthogEnabled = signal<boolean>(false);

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

    // Add PostHog configuration if available
    const posthogKey = this.posthogApiKey();
    if (posthogKey) {
      config.posthog = {
        apiKey: posthogKey,
        apiHost: this.posthogApiHost(),
        enabled: this.posthogEnabled(),
      };
    }

    return config;
  });

  // Signaux dérivés (computed)
  readonly isDevelopment = computed(() => this.environment() === 'development');
  readonly isProduction = computed(() => this.environment() === 'production');
  readonly isLocal = computed(() => this.environment() === 'local');

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

    this.supabaseUrl.set(supabaseUrl);
    this.supabaseAnonKey.set(config.supabase.anonKey);
    this.backendApiUrl.set(backendApiUrl);
    this.environment.set(config.environment);

    // Apply PostHog configuration if present
    if (config.posthog) {
      this.posthogApiKey.set(config.posthog.apiKey);
      this.posthogApiHost.set(
        config.posthog.apiHost || 'https://app.posthog.com',
      );
      this.posthogEnabled.set(config.posthog.enabled);
    }
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
  }
}
