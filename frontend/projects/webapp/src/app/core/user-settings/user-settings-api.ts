import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, computed, resource } from '@angular/core';
import {
  type UserSettings,
  type UserSettingsResponse,
  type UpdateUserSettings,
  userSettingsResponseSchema,
} from 'pulpe-shared';
import { type Observable, firstValueFrom, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApplicationConfiguration } from '../config/application-configuration';
import { AuthApi } from '../auth/auth-api';
import { Logger } from '../logging/logger';

/**
 * UserSettingsApi - Service for managing user settings
 *
 * Provides access to user preferences like payDayOfMonth.
 * Uses Angular's resource() API for reactive data loading.
 */
@Injectable({
  providedIn: 'root',
})
export class UserSettingsApi {
  readonly #httpClient = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #authApi = inject(AuthApi);
  readonly #logger = inject(Logger);

  readonly #reloadTrigger = signal(0);

  readonly #settingsResource = resource<
    UserSettings | null,
    { isAuthenticated: boolean; trigger: number }
  >({
    params: () => ({
      isAuthenticated: this.#authApi.isAuthenticated(),
      trigger: this.#reloadTrigger(),
    }),
    loader: async ({ params }) =>
      params.isAuthenticated ? this.#loadSettings() : null,
  });

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/users/settings`;
  }

  /**
   * Current user settings (reactive)
   */
  readonly settings = computed(() => this.#settingsResource.value());

  /**
   * Pay day of month setting (reactive)
   * Returns null if not set (calendar-based behavior)
   */
  readonly payDayOfMonth = computed(
    () => this.settings()?.payDayOfMonth ?? null,
  );

  /**
   * Loading state
   */
  readonly isLoading = computed(() => this.#settingsResource.isLoading());

  /**
   * Error state
   */
  readonly error = computed(() => this.#settingsResource.error());

  /**
   * Initialize settings by triggering the resource load
   */
  initialize(): void {
    // Resource will auto-load on first access, but we can trigger explicitly
    this.#reloadTrigger.update((v) => v + 1);
  }

  /**
   * Update user settings
   */
  async updateSettings(settings: UpdateUserSettings): Promise<UserSettings> {
    try {
      const response = await firstValueFrom(
        this.#httpClient.put<UserSettingsResponse>(this.#apiUrl, settings).pipe(
          map((res) => {
            const validated = userSettingsResponseSchema.parse(res);
            return validated.data;
          }),
          tap((data) => {
            // Update local state immediately
            this.#settingsResource.set(data);
          }),
          catchError((error) => this.#handleError(error)),
        ),
      );

      return response;
    } catch (error) {
      this.#logger.error('Failed to update user settings', { error });
      throw error;
    }
  }

  /**
   * Reload settings from server
   */
  reload(): void {
    this.#reloadTrigger.update((v) => v + 1);
  }

  /**
   * Load settings from API
   */
  async #loadSettings(): Promise<UserSettings> {
    try {
      const response = await firstValueFrom(
        this.#httpClient.get<UserSettingsResponse>(this.#apiUrl).pipe(
          map((res) => {
            const validated = userSettingsResponseSchema.parse(res);
            return validated.data;
          }),
          catchError((error) => this.#handleError(error)),
        ),
      );

      return response;
    } catch (error) {
      this.#logger.error('Failed to load user settings', { error });
      // Return default settings on error
      return { payDayOfMonth: null };
    }
  }

  #handleError(error: HttpErrorResponse): Observable<never> {
    this.#logger.error('User settings API error', {
      status: error.status,
      message: error.message,
    });

    return throwError(
      () => new Error('Erreur lors de la gestion des paramètres utilisateur'),
    );
  }
}
