import {
  InjectionToken,
  inject,
  Service,
  signal,
  type WritableSignal,
} from '@angular/core';
import { format } from 'date-fns';
import {
  feedbackCreateSchema,
  feedbackStatusResponseSchema,
  type FeedbackCreate,
} from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CURRENT_APP_VERSION } from '@core/app-version/current-app-version';
import { AuthStore } from '@core/auth/auth-store';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import type { FeedbackPromptState } from '@core/storage/storage-schemas';

export type FeedbackDetails = Pick<
  FeedbackCreate,
  | 'onboarding'
  | 'budgetClarity'
  | 'currentMonth'
  | 'futurePlanning'
  | 'homeClarity'
>;

const ACTIVE_DAYS_BETWEEN_PROMPTS = 3;

const NEW_STATE: FeedbackPromptState = {
  activeDayCount: 0,
  lastActiveDay: null,
  lastPromptedAtActiveDayCount: null,
  promptCount: 0,
  hasSubmitted: false,
};

type FeedbackPromptStates = Record<string, FeedbackPromptState>;

/**
 * Mirror of iOS `FeedbackPromptPreferences.isEligible`: first invitation on the
 * third active day, then every three active days until the account answers.
 */
export function isFeedbackPromptDue(state: FeedbackPromptState): boolean {
  if (state.hasSubmitted) return false;
  if (state.activeDayCount < ACTIVE_DAYS_BETWEEN_PROMPTS) return false;
  const lastPrompt = state.lastPromptedAtActiveDayCount;
  return (
    lastPrompt === null ||
    state.activeDayCount - lastPrompt >= ACTIVE_DAYS_BETWEEN_PROMPTS
  );
}

/**
 * Written by the what's-new toast: true while it is on screen during the load
 * that first showed this version. The feedback invitation has the lowest
 * priority, so it skips that load. The toast never dismisses itself, so later
 * loads must not wait for it, or a user who ignores it would never be invited.
 */
export const WHATS_NEW_ANNOUNCING = new InjectionToken<WritableSignal<boolean>>(
  'WHATS_NEW_ANNOUNCING',
  { providedIn: 'root', factory: () => signal(false) },
);

/**
 * Automatic feedback invitation, web side of iOS `FeedbackPromptPreferences`.
 * The per-account history stays on this device; the server only answers
 * whether the account has already submitted, on any platform.
 */
@Service()
export class FeedbackPrompt {
  readonly #api = inject(ApiClient);
  readonly #authStore = inject(AuthStore);
  readonly #demoMode = inject(DemoModeService);
  readonly #storage = inject(StorageService);
  readonly #appVersion = inject(CURRENT_APP_VERSION);

  // One status request at a time. Released once it settles: the invitation
  // recorded in storage is what keeps the next one three active days away, so
  // a tab left open re-offers on the active day it becomes due again.
  #claimed = false;

  readonly #activeDay = signal<string | null>(null);
  /** The last recorded active day, so the shell can re-offer on a new one. */
  readonly activeDay = this.#activeDay.asReadonly();

  recordActiveDay(now = new Date()): void {
    const userId = this.#authStore.user()?.id;
    if (!userId) return;
    const today = format(now, 'yyyy-MM-dd');
    this.#activeDay.set(today);
    this.#update(userId, (state) =>
      state.lastActiveDay === today
        ? state
        : {
            ...state,
            lastActiveDay: today,
            activeDayCount: state.activeDayCount + 1,
          },
    );
  }

  /**
   * Resolves the 1-based invitation number when the dialog should open now,
   * `null` otherwise. `canOpen` is checked again once the status is known, so
   * a dialog opened in the meantime still wins.
   */
  async claimAutomaticPrompt(canOpen: () => boolean): Promise<number | null> {
    const userId = this.#authStore.user()?.id;
    if (
      !userId ||
      this.#claimed ||
      this.#demoMode.isDemoMode() ||
      !isFeedbackPromptDue(this.#read(userId)) ||
      !canOpen()
    ) {
      return null;
    }

    this.#claimed = true;
    try {
      const { hasSubmitted } = await firstValueFrom(
        this.#api.get$('/feedback/status', feedbackStatusResponseSchema),
      );
      if (hasSubmitted) {
        this.#update(userId, (state) => ({ ...state, hasSubmitted: true }));
      } else if (canOpen()) {
        const promptNumber = this.#read(userId).promptCount + 1;
        this.#update(userId, (state) => ({
          ...state,
          lastPromptedAtActiveDayCount: state.activeDayCount,
          promptCount: promptNumber,
        }));
        return promptNumber;
      }
    } catch {
      // Fail closed: no invitation without a confirmed status.
    } finally {
      this.#claimed = false;
    }
    return null;
  }

  async submit(
    overallRating: number,
    comment: string,
    details: FeedbackDetails = {},
  ): Promise<void> {
    await firstValueFrom(
      this.#api.postVoid$<FeedbackCreate>(
        '/feedback',
        {
          ...details,
          overallRating,
          comment,
          appVersion: this.#appVersion,
          platform: 'web',
        },
        feedbackCreateSchema,
      ),
    );
    const userId = this.#authStore.user()?.id;
    if (userId) {
      this.#update(userId, (state) => ({ ...state, hasSubmitted: true }));
    }
  }

  #read(userId: string): FeedbackPromptState {
    return (
      this.#storage.get<FeedbackPromptStates>(STORAGE_KEYS.FEEDBACK_PROMPT)?.[
        userId
      ] ?? NEW_STATE
    );
  }

  #update(
    userId: string,
    change: (state: FeedbackPromptState) => FeedbackPromptState,
  ): void {
    const states =
      this.#storage.get<FeedbackPromptStates>(STORAGE_KEYS.FEEDBACK_PROMPT) ??
      {};
    this.#storage.set(STORAGE_KEYS.FEEDBACK_PROMPT, {
      ...states,
      [userId]: change(states[userId] ?? NEW_STATE),
    });
  }
}
