import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  type BudgetGenerate,
  type BudgetTemplateCreateFromOnboarding,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateCreateResponseSchema,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { BudgetApi } from '@core/budget';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import {
  type ProfileData,
  type ProfileSetupResult,
} from './profile-setup.types';

const INITIAL_BUDGET_MONTHS = 12;

@Injectable({
  providedIn: 'root',
})
export class ProfileSetupService {
  readonly #api = inject(ApiClient);
  readonly #budgetApi = inject(BudgetApi);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  async createInitialBudget(
    profileData: ProfileData,
  ): Promise<ProfileSetupResult> {
    if (
      !profileData.firstName ||
      !profileData.monthlyIncome ||
      profileData.monthlyIncome <= 0
    ) {
      return {
        success: false,
        error: this.#transloco.translate('completeProfile.missingDataError'),
      };
    }

    const templateRequest: BudgetTemplateCreateFromOnboarding = {
      name: 'Mois Standard',
      description: `Template personnel de ${profileData.firstName}`,
      isDefault: true,
      monthlyIncome: profileData.monthlyIncome,
      housingCosts: profileData.housingCosts ?? 0,
      healthInsurance: profileData.healthInsurance ?? 0,
      leasingCredit: profileData.leasingCredit ?? 0,
      phonePlan: profileData.phonePlan ?? 0,
      internetPlan: profileData.internetPlan ?? 0,
      transportCosts: profileData.transportCosts ?? 0,
      customTransactions: profileData.customTransactions ?? [],
    };

    let templateId: string;
    try {
      const templateResponse = await firstValueFrom(
        this.#createTemplateFromOnboarding$(templateRequest),
      );
      templateId = templateResponse.data.template.id;
    } catch (error: unknown) {
      this.#logger.error('Template creation failed:', error);
      return {
        success: false,
        error: this.#transloco.translate('completeProfile.templateCreateError'),
      };
    }

    const currentDate = new Date();
    const { month, year } = getBudgetPeriodForDate(
      currentDate,
      profileData.payDayOfMonth,
    );
    const generateRequest: BudgetGenerate = {
      templateId,
      startMonth: month,
      startYear: year,
      count: INITIAL_BUDGET_MONTHS,
    };

    try {
      await firstValueFrom(this.#budgetApi.generateBudgets$(generateRequest));
    } catch (error: unknown) {
      this.#logger.error('Budget generation failed:', error);
      return {
        success: false,
        error: this.#transloco.translate('completeProfile.budgetGenerateError'),
      };
    }

    this.#budgetApi.cache.invalidate(['budget']);
    await this.#budgetApi.cache
      .prefetch(['budget', 'list'], () =>
        firstValueFrom(this.#budgetApi.getAllBudgets$()),
      )
      .catch((error: unknown) => {
        this.#logger.warn(
          '[ProfileSetupService] Failed to prefetch budget list after onboarding',
          error,
        );
      });

    this.#postHogService.enableTracking();
    this.#logger.info('PostHog tracking enabled after profile setup');

    return { success: true };
  }

  #createTemplateFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ) {
    return this.#api.post$(
      '/budget-templates/from-onboarding',
      onboardingData,
      budgetTemplateCreateResponseSchema,
      budgetTemplateCreateFromOnboardingSchema,
    );
  }
}
