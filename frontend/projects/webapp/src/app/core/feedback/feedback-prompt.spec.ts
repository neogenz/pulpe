import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@core/api/api-client';
import { AuthStore } from '@core/auth/auth-store';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import type { FeedbackPromptState } from '@core/storage/storage-schemas';
import { FeedbackPrompt, isFeedbackPromptDue } from './feedback-prompt';

const state = (
  overrides: Partial<FeedbackPromptState>,
): FeedbackPromptState => ({
  activeDayCount: 0,
  lastActiveDay: null,
  lastPromptedAtActiveDayCount: null,
  promptCount: 0,
  hasSubmitted: false,
  ...overrides,
});

describe('isFeedbackPromptDue', () => {
  it('should first invite on the third active day, not the second', () => {
    expect(isFeedbackPromptDue(state({ activeDayCount: 2 }))).toBe(false);
    expect(isFeedbackPromptDue(state({ activeDayCount: 3 }))).toBe(true);
  });

  it('should wait until day 6 after a dismissal at day 3', () => {
    const dismissed = { lastPromptedAtActiveDayCount: 3, promptCount: 1 };
    expect(
      isFeedbackPromptDue(state({ ...dismissed, activeDayCount: 5 })),
    ).toBe(false);
    expect(
      isFeedbackPromptDue(state({ ...dismissed, activeDayCount: 6 })),
    ).toBe(true);
  });

  it('should never invite again once submitted', () => {
    expect(
      isFeedbackPromptDue(state({ activeDayCount: 9, hasSubmitted: true })),
    ).toBe(false);
  });
});

describe('FeedbackPrompt.claimAutomaticPrompt', () => {
  const USER_ID = 'user-1';

  function setup(options: {
    status: () => Observable<{ hasSubmitted: boolean }>;
    activeDayCount?: number;
    isDemoMode?: boolean;
  }) {
    const stored = new Map<string, unknown>();
    stored.set(STORAGE_KEYS.FEEDBACK_PROMPT, {
      [USER_ID]: state({ activeDayCount: options.activeDayCount ?? 3 }),
    });
    const get$ = vi.fn(options.status);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiClient, useValue: { get$ } },
        { provide: AuthStore, useValue: { user: signal({ id: USER_ID }) } },
        {
          provide: DemoModeService,
          useValue: { isDemoMode: signal(options.isDemoMode ?? false) },
        },
        {
          provide: StorageService,
          useValue: {
            get: (key: string) => stored.get(key) ?? null,
            set: (key: string, value: unknown) => stored.set(key, value),
          },
        },
      ],
    });
    const stateOf = () =>
      (
        stored.get(STORAGE_KEYS.FEEDBACK_PROMPT) as Record<
          string,
          FeedbackPromptState
        >
      )[USER_ID];
    return { prompt: TestBed.inject(FeedbackPrompt), get$, stateOf };
  }

  it('should return the invitation number and record it when due and unanswered', async () => {
    const { prompt, stateOf } = setup({
      status: () => of({ hasSubmitted: false }),
    });

    expect(await prompt.claimAutomaticPrompt(() => true)).toBe(1);
    expect(stateOf()).toMatchObject({
      promptCount: 1,
      lastPromptedAtActiveDayCount: 3,
    });
  });

  it('should remember an answer given on another platform and not open', async () => {
    const { prompt, stateOf } = setup({
      status: () => of({ hasSubmitted: true }),
    });

    expect(await prompt.claimAutomaticPrompt(() => true)).toBeNull();
    expect(stateOf()).toMatchObject({ hasSubmitted: true, promptCount: 0 });
  });

  it('should fail closed on a status error and allow a later attempt', async () => {
    let fails = true;
    const { prompt, stateOf } = setup({
      status: () =>
        fails
          ? throwError(() => new Error('offline'))
          : of({ hasSubmitted: false }),
    });

    expect(await prompt.claimAutomaticPrompt(() => true)).toBeNull();
    expect(stateOf().promptCount).toBe(0);

    fails = false;
    expect(await prompt.claimAutomaticPrompt(() => true)).toBe(1);
  });

  it('should not open when another dialog opened during the status request', async () => {
    let canOpen = true;
    const status = new Subject<{ hasSubmitted: boolean }>();
    const { prompt, stateOf } = setup({ status: () => status });

    const claim = prompt.claimAutomaticPrompt(() => canOpen);
    canOpen = false;
    status.next({ hasSubmitted: false });
    status.complete();

    expect(await claim).toBeNull();
    expect(stateOf().promptCount).toBe(0);
  });

  it('should ask the server only once for concurrent claims', async () => {
    const status = new Subject<{ hasSubmitted: boolean }>();
    const { prompt, get$ } = setup({ status: () => status });

    const first = prompt.claimAutomaticPrompt(() => true);
    const second = prompt.claimAutomaticPrompt(() => true);
    status.next({ hasSubmitted: false });
    status.complete();

    expect(await first).toBe(1);
    expect(await second).toBeNull();
    expect(get$).toHaveBeenCalledTimes(1);
  });

  it('should never ask the server in demo mode or before it is due', async () => {
    const demo = setup({
      status: () => of({ hasSubmitted: false }),
      isDemoMode: true,
    });
    expect(await demo.prompt.claimAutomaticPrompt(() => true)).toBeNull();
    expect(demo.get$).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const early = setup({
      status: () => of({ hasSubmitted: false }),
      activeDayCount: 2,
    });
    expect(await early.prompt.claimAutomaticPrompt(() => true)).toBeNull();
    expect(early.get$).not.toHaveBeenCalled();
  });
});
