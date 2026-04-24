import { Injectable, computed, inject } from '@angular/core';
import { PostHogService } from '../analytics/posthog';

/**
 * Reactive access to PostHog feature flags.
 *
 * Each flag exposes a signal-backed computed so consumers (templates, other
 * computeds, effects) re-evaluate when PostHog resolves or refreshes flags.
 *
 * To add a flag: register the key in `shared/src/feature-flags.ts`, then add
 * a corresponding `readonly isXxxEnabled = computed(...)` here.
 */
@Injectable({
  providedIn: 'root',
})
export class FeatureFlagsService {
  readonly #posthog = inject(PostHogService);

  readonly isMultiCurrencyEnabled = computed(() => {
    // Reactive dependency: re-evaluate whenever PostHog reloads flags.
    this.#posthog.flagsVersion();
    return true;
  });
}
