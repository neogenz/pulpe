import { Service, inject } from '@angular/core';

import { BudgetApi } from '@core/budget';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { ClientKeyService } from '@core/encryption';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { TagApi } from '@core/tag/tag-api';

import { DemoModeService } from '../demo/demo-mode.service';
import { PreloadService } from '../preload/preload.service';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { Logger } from '../logging/logger';

@Service()
export class AuthCleanupService {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #savingsGoalApi = inject(SavingsGoalApi);
  readonly #tagApi = inject(TagApi);
  readonly #demoModeService = inject(DemoModeService);
  readonly #preloadService = inject(PreloadService);
  readonly #postHogService = inject(PostHogService);
  readonly #storageService = inject(StorageService);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #logger = inject(Logger);

  performCleanup(): void {
    this.#safeCleanup(
      () => this.#clientKeyService.clearPreservingDeviceTrust(),
      'client key',
    );
    this.#safeCleanup(
      () => this.#demoModeService.deactivateDemoMode(),
      'demo mode',
    );
    this.#safeCleanup(() => this.#budgetApi.clearCache(), 'budget data cache');
    this.#safeCleanup(
      () => this.#budgetTemplatesApi.clearCache(),
      'templates data cache',
    );
    this.#safeCleanup(
      () => this.#savingsGoalApi.clearCache(),
      'savings goals data cache',
    );
    this.#safeCleanup(() => this.#tagApi.clearCache(), 'tags data cache');
    this.#safeCleanup(() => this.#preloadService.reset(), 'preload state');
    this.#safeCleanup(() => this.#userSettingsStore.reset(), 'user settings');
    this.#safeCleanup(() => this.#postHogService.reset(), 'PostHog');
    this.#safeCleanup(() => this.#storageService.clearAllUserData(), 'storage');
  }

  #safeCleanup(operation: () => void, name: string): void {
    try {
      operation();
    } catch (error) {
      this.#logger.error(`Cleanup failed: ${name}`, { error });
    }
  }
}
