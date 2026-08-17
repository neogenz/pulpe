import { effect, inject, Service, computed } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import { type UserSettings, type UpdateUserSettings } from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import { readPersistedCurrency } from './currency-snapshot';
import { resolveStartupLanguage } from '../i18n/language-resolver';
import { UserSettingsApi } from './user-settings-api';

@Service()
export class UserSettingsStore {
  readonly #api = inject(UserSettingsApi);
  readonly #authStore = inject(AuthStore);
  readonly #clientKey = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #storage = inject(StorageService);
  readonly #settingsResource = cachedResource<
    UserSettings | null,
    { isReady: boolean }
  >({
    cache: this.#api.cache,
    cacheKey: ['settings', 'user'],
    params: () => {
      const isReady =
        this.#authStore.isAuthenticated() &&
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

  /** Snapshot fallback avoids a Swiss-format flash for EUR users while settings load. */
  readonly #fallbackCurrency = readPersistedCurrency(this.#storage);

  readonly currency = computed(
    () => this.settings()?.currency ?? this.#fallbackCurrency,
  );

  /** Same snapshot trick for the language the app already booted in. */
  readonly #fallbackLocale = resolveStartupLanguage(this.#storage);

  readonly locale = computed(
    () => this.settings()?.locale ?? this.#fallbackLocale,
  );

  readonly showCurrencySelector = computed(
    () => this.settings()?.showCurrencySelector ?? false,
  );

  readonly isLoading = this.#settingsResource.isInitialLoading;

  readonly error = this.#settingsResource.error;

  constructor() {
    // Persist the currency so the next bootstrap can pick the formatting locale
    // (fr-CH / fr-FR) before settings are loaded from the API.
    effect(() => {
      const currency = this.settings()?.currency;
      if (currency) {
        this.#storage.setString(STORAGE_KEYS.SETTINGS_CURRENCY, currency);
      }
    });

    // Same for the language, so the next cold start loads the right catalog
    // before the first paint — and so the signed-out screens keep it.
    //
    // A language chosen on another device lands here after this page already
    // rendered. It is written down and applied on the next start rather than
    // reloading on the spot: a reload driven by a resource that can re-resolve
    // is one failed storage write away from looping.
    effect(() => {
      const locale = this.settings()?.locale;
      if (locale) {
        this.#storage.setString(STORAGE_KEYS.SETTINGS_LANGUAGE, locale);
      }
    });
  }

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
    this.#settingsResource.set(null);
  }
}
