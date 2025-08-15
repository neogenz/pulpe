import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ApplicationConfig, ConfigFile } from './types';
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

    return {
      supabase: { url, anonKey: key },
      backend: { apiUrl },
      environment: env,
    };
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
      const validatedConfig = this.#validateConfig(configData);
      this.#applyConfiguration(validatedConfig);
      this.#logger.info('Configuration loaded successfully');
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
    return firstValueFrom(this.#http.get<ConfigFile>('/config.json'));
  }

  /**
   * Valide la structure de la configuration
   */
  #validateConfig(config: ConfigFile): ApplicationConfig {
    // Validation basique - peut être étendue avec Zod si nécessaire
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration invalide: structure incorrecte');
    }

    if (!this.#hasValidSupabaseConfig(config)) {
      throw new Error('Configuration invalide: paramètres Supabase manquants');
    }

    if (!this.#hasValidBackendConfig(config)) {
      throw new Error("Configuration invalide: URL de l'API backend manquante");
    }

    if (!this.#hasValidEnvironment(config)) {
      throw new Error('Configuration invalide: environnement non valide');
    }

    // À ce point, on sait que la structure est correcte grâce aux type guards
    const validConfig = config as {
      supabase: { url: string; anonKey: string };
      backend: { apiUrl: string };
      environment: 'development' | 'production' | 'local';
    };

    return {
      supabase: {
        url: validConfig.supabase.url,
        anonKey: validConfig.supabase.anonKey,
      },
      backend: {
        apiUrl: validConfig.backend.apiUrl,
      },
      environment: validConfig.environment,
    };
  }

  /**
   * Vérifie que la configuration Supabase est valide
   */
  #hasValidSupabaseConfig(config: ConfigFile): config is ConfigFile & {
    supabase: { url: string; anonKey: string };
  } {
    return (
      'supabase' in config &&
      config['supabase'] !== null &&
      typeof config['supabase'] === 'object' &&
      'url' in config['supabase'] &&
      'anonKey' in config['supabase'] &&
      typeof (config['supabase'] as Record<string, unknown>)['url'] ===
        'string' &&
      typeof (config['supabase'] as Record<string, unknown>)['anonKey'] ===
        'string' &&
      ((config['supabase'] as Record<string, unknown>)['url'] as string)
        .length > 0 &&
      ((config['supabase'] as Record<string, unknown>)['anonKey'] as string)
        .length > 0
    );
  }

  /**
   * Vérifie que la configuration backend est valide
   */
  #hasValidBackendConfig(config: ConfigFile): config is ConfigFile & {
    backend: { apiUrl: string };
  } {
    return (
      'backend' in config &&
      config['backend'] !== null &&
      typeof config['backend'] === 'object' &&
      'apiUrl' in config['backend'] &&
      typeof (config['backend'] as Record<string, unknown>)['apiUrl'] ===
        'string' &&
      ((config['backend'] as Record<string, unknown>)['apiUrl'] as string)
        .length > 0
    );
  }

  /**
   * Vérifie que l'environnement est valide
   */
  #hasValidEnvironment(config: ConfigFile): config is ConfigFile & {
    environment: 'development' | 'production' | 'local';
  } {
    return (
      'environment' in config &&
      typeof config['environment'] === 'string' &&
      ['development', 'production', 'local'].includes(
        config['environment'] as string,
      )
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
  }

  /**
   * Définit les valeurs par défaut en cas d'erreur
   */
  #setDefaults(): void {
    this.supabaseUrl.set('');
    this.supabaseAnonKey.set('');
    this.backendApiUrl.set('http://localhost:3000/api/v1');
    this.environment.set('development');
  }
}
