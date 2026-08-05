import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EnvironmentInjector,
  LOCALE_ID,
  provideZonelessChangeDetection,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ANALYTICS_EVENTS, type SupportedCurrency } from 'pulpe-shared';
import CompleteProfilePage from './complete-profile-page';
import { CompleteProfileStore } from './complete-profile-store';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '../../testing/transloco-testing';

describe('CompleteProfilePage', () => {
  let updateHealthInsurance: ReturnType<typeof vi.fn>;
  let captureEvent: ReturnType<typeof vi.fn>;

  function createPage(
    initialCurrency: SupportedCurrency,
    hasAnyCharge = false,
  ): CompleteProfilePage {
    updateHealthInsurance = vi.fn();
    captureEvent = vi.fn();
    const mockStore = {
      housingCosts: signal<number | null>(hasAnyCharge ? 100 : null),
      healthInsurance: signal<number | null>(null),
      phonePlan: signal<number | null>(null),
      internetPlan: signal<number | null>(null),
      transportCosts: signal<number | null>(null),
      leasingCredit: signal<number | null>(null),
      updateHealthInsurance,
      isStep1Valid: vi.fn().mockReturnValue(true),
      submitProfile: vi.fn().mockResolvedValue(false),
      // Awaited by the constructor's #initPage — resolve so it never rejects.
      checkExistingBudgets: vi.fn().mockResolvedValue(false),
      prefillFromOAuthMetadata: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: CompleteProfileStore, useValue: mockStore },
        { provide: Router, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: PostHogService, useValue: { captureEvent } },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal(initialCurrency),
            showCurrencySelector: signal(false),
          },
        },
        { provide: LOCALE_ID, useValue: 'fr-CH' },
      ],
    });

    const injector = TestBed.inject(EnvironmentInjector);
    return runInInjectionContext(injector, () => new CompleteProfilePage());
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the health-insurance field for EUR users', () => {
    const page = createPage('EUR') as unknown as {
      showHealthInsurance: () => boolean;
    };

    expect(page.showHealthInsurance()).toBe(false);
  });

  it('shows the health-insurance field for CHF users', () => {
    const page = createPage('CHF') as unknown as {
      showHealthInsurance: () => boolean;
    };

    expect(page.showHealthInsurance()).toBe(true);
  });

  it('clears a health-insurance amount when switching to EUR', () => {
    const page = createPage('CHF') as unknown as {
      onCurrencyChange: (c: SupportedCurrency) => void;
    };

    page.onCurrencyChange('EUR');

    expect(updateHealthInsurance).toHaveBeenCalledWith(null);
  });

  it('keeps the health-insurance amount when staying on CHF', () => {
    const page = createPage('CHF') as unknown as {
      onCurrencyChange: (c: SupportedCurrency) => void;
    };

    page.onCurrencyChange('CHF');

    expect(updateHealthInsurance).not.toHaveBeenCalled();
  });

  it('maps the profile step to onboarding_step_completed', async () => {
    const page = createPage('CHF') as unknown as { nextStep: () => void };
    await vi.waitFor(() =>
      expect(captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ONBOARDING_STARTED,
      ),
    );
    captureEvent.mockClear();

    page.nextStep();

    expect(captureEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED,
      { step: 'profile' },
    );
  });

  it.each([
    [true, false],
    [false, true],
  ])(
    'maps charges presence %s to skipped %s',
    async (hasAnyCharge, skipped) => {
      const page = createPage('CHF', hasAnyCharge) as unknown as {
        onSubmit: () => Promise<void>;
      };
      await vi.waitFor(() =>
        expect(captureEvent).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.ONBOARDING_STARTED,
        ),
      );
      captureEvent.mockClear();

      await page.onSubmit();

      expect(captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED,
        { step: 'charges', skipped },
      );
    },
  );
});
