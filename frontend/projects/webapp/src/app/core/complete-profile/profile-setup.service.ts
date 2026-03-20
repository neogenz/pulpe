import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
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

    try {
      // 1. Create template
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
        customTransactions: [],
      };

      const templateResponse = await firstValueFrom(
        this.#createTemplateFromOnboarding$(templateRequest),
      );

      // 2. Create budget
      const currentDate = new Date();
      const { month, year } = getBudgetPeriodForDate(
        currentDate,
        profileData.payDayOfMonth,
      );
      const budgetRequest: BudgetCreate = {
        templateId: templateResponse.data.template.id,
        month,
        year,
        description: `Budget initial de ${profileData.firstName} pour ${year}`,
      };

      const { budget } = await firstValueFrom(
        this.#budgetApi.createBudget$(budgetRequest),
      );
      this.#budgetApi.cache.invalidate(['budget']);
      this.#budgetApi.cache.set(['budget', 'list'], [budget]);

      // 3. Enable PostHog tracking (user has accepted terms)
      this.#postHogService.enableTracking();
      this.#logger.info('PostHog tracking enabled after profile setup');

      return { success: true };
    } catch (error: unknown) {
      this.#logger.error(
        'Erreur lors de la création du budget initial:',
        error,
      );

      const errorMessage = this.#getErrorMessage(error);

      if (errorMessage.includes('template')) {
        return {
          success: false,
          error: this.#transloco.translate(
            'completeProfile.templateCreateError',
          ),
        };
      }

      if (errorMessage.includes('budget')) {
        return {
          success: false,
          error: this.#transloco.translate('completeProfile.budgetCreateError'),
        };
      }

      return {
        success: false,
        error: this.#transloco.translate('completeProfile.unexpectedError'),
      };
    }
  }

  #createTemplateFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ) {
    return this.#api.post$(
      '/budget-templates/from-onboarding',
      onboardingData,
      budgetTemplateCreateResponseSchema,
    );
  }

  #getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return String(error ?? '');
  }
}
