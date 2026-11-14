import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPostHogService } from '@app/testing/mock-posthog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { PostHogService } from '@core/analytics';
import { StorageService, STORAGE_KEYS } from '@core/storage';

import { AndroidBetaInvite } from './android-beta-invite';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/140';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)';

describe('AndroidBetaInvite', () => {
  let postHog: ReturnType<typeof createMockPostHogService>;

  beforeEach(() => {
    localStorage.clear();
    postHog = createMockPostHogService();
  });

  afterEach(() => vi.restoreAllMocks());

  async function render({
    userAgent = ANDROID_UA,
    isFlagOn = true,
    wasDismissed = false,
  } = {}) {
    postHog.isFeatureEnabled.mockReturnValue(isFlagOn);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    await TestBed.configureTestingModule({
      imports: [AndroidBetaInvite],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: PostHogService, useValue: postHog },
      ],
    }).compileComponents();
    if (wasDismissed) {
      TestBed.inject(StorageService).set(
        STORAGE_KEYS.ANDROID_BETA_INVITE_DISMISSED,
        true,
      );
    }
    const fixture = TestBed.createComponent(AndroidBetaInvite);
    await fixture.whenStable();
    const find = (testId: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    return { fixture, find };
  }

  it('should invite an Android visitor when the flag is on', async () => {
    const { find } = await render();

    expect(find('android-beta-invite-section')).not.toBeNull();
  });

  it('should stay hidden when the flag is off', async () => {
    const { find } = await render({ isFlagOn: false });

    expect(find('android-beta-invite-section')).toBeNull();
  });

  it('should stay hidden on a device that is not Android', async () => {
    const { find } = await render({ userAgent: IPHONE_UA });

    expect(find('android-beta-invite-section')).toBeNull();
  });

  it('should stay hidden once dismissed on an earlier visit', async () => {
    const { find } = await render({ wasDismissed: true });

    expect(find('android-beta-invite-section')).toBeNull();
  });

  it('should hide, remember and report a dismissal', async () => {
    const { fixture, find } = await render();

    find('android-beta-invite-dismiss-button')?.click();
    await fixture.whenStable();

    expect(find('android-beta-invite-section')).toBeNull();
    expect(
      TestBed.inject(StorageService).get<boolean>(
        STORAGE_KEYS.ANDROID_BETA_INVITE_DISMISSED,
      ),
    ).toBe(true);
    expect(postHog.captureEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.ANDROID_BETA_INVITE_DISMISSED,
    );
  });

  it.each(['group', 'install'] as const)(
    'should report the %s step when its link is followed',
    async (step) => {
      const { find } = await render();
      const link = find(`android-beta-invite-${step}-link`);
      link?.addEventListener('click', (event) => event.preventDefault());

      link?.click();

      expect(postHog.captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ANDROID_BETA_INVITE_CLICKED,
        { step },
      );
    },
  );
});
