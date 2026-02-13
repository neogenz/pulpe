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
import { Logger } from '../logging/logger';

@Injectable({
  providedIn: 'root',
})
export class UserSettingsApi {
  readonly #api = inject(ApiClient);
  readonly #authState = inject(AuthStateService);
  readonly #logger = inject(Logger);

  readonly #reloadTrigger = signal(0);

  readonly #settingsResource = resource<
    UserSettings | null,
    { isAuthenticated: boolean; trigger: number }
  >({
    params: () => ({
      isAuthenticated: this.#authState.isAuthenticated(),
      trigger: this.#reloadTrigger(),
    }),
    loader: async ({ params }) =>
      params.isAuthenticated ? this.#loadSettings() : null,
  });

  readonly settings = computed(() => this.#settingsResource.value());

  readonly payDayOfMonth = computed(
    () => this.settings()?.payDayOfMonth ?? null,
  );

  readonly isLoading = computed(() => this.#settingsResource.isLoading());

  readonly error = computed(() => this.#settingsResource.error());

  initialize(): void {
    this.#reloadTrigger.update((v) => v + 1);
  }

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
