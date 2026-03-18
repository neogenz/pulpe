import { inject, Injectable, computed } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import { type UserSettings, type UpdateUserSettings } from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsApi } from './user-settings-api';

@Injectable({
  providedIn: 'root',
})
export class UserSettingsStore {
  readonly #api = inject(UserSettingsApi);
  readonly #authState = inject(AuthStateService);
  readonly #clientKey = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #settingsResource = cachedResource<
    UserSettings | null,
    { isReady: boolean }
  >({
    cache: this.#api.cache,
    cacheKey: ['settings', 'user'],
    params: () => {
      const isReady =
        this.#authState.isAuthenticated() &&
        (this.#clientKey.hasClientKey() || this.#demoMode.isDemoMode());
      return isReady ? { isReady } : undefined;
    },
    loader: () =>
      this.#api.getSettings$().pipe(map((response) => response.data)),
  });

  readonly settings = computed(() => this.#settingsResource.value());

  readonly payDayOfMonth = computed(
    () => this.settings()?.payDayOfMonth ?? null,
  );

  readonly isLoading = this.#settingsResource.isInitialLoading;

  readonly error = this.#settingsResource.error;

  async updateSettings(settings: UpdateUserSettings): Promise<UserSettings> {
    const response = await firstValueFrom(this.#api.updateSettings$(settings));
    this.#settingsResource.set(response.data);
    return response.data;
  }

  reload(): void {
    this.#settingsResource.reload();
  }

  async deleteAccount(): Promise<void> {
    await this.#api.deleteAccount();
  }

  reset(): void {
    this.#api.cache.clear();
  }
}
