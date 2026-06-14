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
import { type SupportedCurrency } from 'pulpe-shared';
import CompleteProfilePage from './complete-profile-page';
import { CompleteProfileStore } from './complete-profile-store';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { FeatureFlagsService } from '@core/feature-flags';
import { provideTranslocoForTest } from '../../testing/transloco-testing';

describe('CompleteProfilePage — health-insurance currency gating', () => {
  let updateHealthInsurance: ReturnType<typeof vi.fn>;

  function createPage(initialCurrency: SupportedCurrency): CompleteProfilePage {
    updateHealthInsurance = vi.fn();
    const mockStore = {
      healthInsurance: signal<number | null>(null),
      updateHealthInsurance,
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
        { provide: PostHogService, useValue: { captureEvent: vi.fn() } },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal(initialCurrency),
            showCurrencySelector: signal(false),
          },
        },
        {
          provide: FeatureFlagsService,
          useValue: { isMultiCurrencyEnabled: signal(true) },
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
});
