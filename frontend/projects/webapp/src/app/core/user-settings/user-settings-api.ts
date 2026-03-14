import { inject, Injectable, computed } from '@angular/core';
import { DataCache, cachedResource } from 'ngx-ziflux';
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

@Injectable({
  providedIn: 'root',
})
export class UserSettingsApi {
  readonly #api = inject(ApiClient);
  readonly #authState = inject(AuthStateService);
  readonly #clientKey = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #logger = inject(Logger);

  readonly cache = new DataCache({
    name: 'settings',
    staleTime: 60_000,
    expireTime: 600_000,
  });

  readonly #settingsResource = cachedResource<
    UserSettings | null,
    { isReady: boolean }
  >({
    cache: this.cache,
    cacheKey: ['settings', 'user'],
    params: () => {
      const isReady =
        this.#authState.isAuthenticated() &&
        (this.#clientKey.hasClientKey() || this.#demoMode.isDemoMode());
      return isReady ? { isReady } : undefined;
    },
    loader: async () => this.#loadSettings(),
  });

  readonly settings = computed(() => this.#settingsResource.value());

  readonly payDayOfMonth = computed(
    () => this.settings()?.payDayOfMonth ?? null,
  );

  readonly isLoading = this.#settingsResource.isLoading;

  readonly error = this.#settingsResource.error;

  async updateSettings(settings: UpdateUserSettings): Promise<UserSettings> {
    const response = await firstValueFrom(
      this.#api.put$('/users/settings', settings, userSettingsResponseSchema),
    );
    this.#settingsResource.set(response.data);
    return response.data;
  }

  reload(): void {
    this.cache.invalidate(['settings']);
    this.#settingsResource.reload();
  }

  reset(): void {
    this.cache.clear();
    this.#settingsResource.set(null);
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
