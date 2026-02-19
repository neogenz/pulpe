import { inject, Injectable, signal, computed, resource } from '@angular/core';
import {
  type UserSettings,
  type UpdateUserSettings,
  type DeleteAccountResponse,
  userSettingsResponseSchema,
  deleteAccountResponseSchema,
} from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/api/api-client';
import { AuthStateService } from '../auth/auth-state.service';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { Logger } from '../logging/logger';

/**
 * Hybrid API + Store service for user settings.
 *
 * Combines API calls with local resource caching because settings are:
 * - Read frequently (every component that needs payDayOfMonth)
 * - Written rarely (only from settings page)
 * - Needed at app startup (PreloadService)
 *
 * This avoids an extra store layer for a single, rarely-mutated resource.
 */
@Injectable({
  providedIn: 'root',
})
export class UserSettingsApi {
  readonly #api = inject(ApiClient);
  readonly #authState = inject(AuthStateService);
  readonly #clientKey = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #logger = inject(Logger);

  readonly #reloadTrigger = signal(0);

  readonly #settingsResource = resource<
    UserSettings | null,
    { isReady: boolean; trigger: number }
  >({
    params: () => ({
      isReady:
        this.#authState.isAuthenticated() &&
        (this.#clientKey.hasClientKey() || this.#demoMode.isDemoMode()),
      trigger: this.#reloadTrigger(),
    }),
    loader: async ({ params }) =>
      params.isReady ? this.#loadSettings() : null,
  });

  readonly settings = computed(() => this.#settingsResource.value());

  readonly payDayOfMonth = computed(
    () => this.settings()?.payDayOfMonth ?? null,
  );

  readonly isLoading = computed(() => this.#settingsResource.isLoading());

  readonly error = computed(() => this.#settingsResource.error());

  async updateSettings(settings: UpdateUserSettings): Promise<UserSettings> {
    const response = await firstValueFrom(
      this.#api.put$('/users/settings', settings, userSettingsResponseSchema),
    );
    this.#settingsResource.set(response.data);
    return response.data;
  }

  reload(): void {
    this.#reloadTrigger.update((v) => v + 1);
  }

  reset(): void {
    this.#settingsResource.set(null);
    this.#reloadTrigger.set(0);
  }

  async deleteAccount(): Promise<DeleteAccountResponse> {
    return firstValueFrom(
      this.#api.delete$('/users/account', deleteAccountResponseSchema),
    );
  }

  async #loadSettings(): Promise<UserSettings> {
    try {
      const response = await firstValueFrom(
        this.#api.get$('/users/settings', userSettingsResponseSchema),
      );
      return response.data;
    } catch (error) {
      this.#logger.error('Failed to load user settings', { error });
      return { payDayOfMonth: null };
    }
  }
}
