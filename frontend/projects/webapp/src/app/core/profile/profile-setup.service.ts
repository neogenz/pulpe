import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
} from 'pulpe-shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
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
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #budgetApi = inject(BudgetApi);
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);

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
        error: 'Données obligatoires manquantes (prénom et revenu mensuel)',
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
        transportCosts: profileData.transportCosts ?? 0,
        customTransactions: [],
      };

      const templateResponse = await firstValueFrom(
        this.#createTemplateFromOnboarding$(templateRequest),
      );

      // 2. Create budget
      const currentDate = new Date();
      const budgetRequest: BudgetCreate = {
        templateId: templateResponse.data.template.id,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        description: `Budget initial de ${profileData.firstName} pour ${currentDate.getFullYear()}`,
      };

      await firstValueFrom(this.#budgetApi.createBudget$(budgetRequest));

      // 3. Enable PostHog tracking (user has accepted terms)
      this.#postHogService.enableTracking();
      this.#logger.info('PostHog tracking enabled after profile setup');

      return { success: true };
    } catch (error) {
      this.#logger.error(
        'Erreur lors de la création du budget initial:',
        error,
      );

      const errorMessage = error?.toString() || '';
      const errorObj = error as { message?: string };

      if (
        errorMessage.includes('template') ||
        errorObj?.message?.includes('template')
      ) {
        return {
          success: false,
          error: 'Erreur lors de la création de votre template budgétaire.',
        };
      }

      if (
        errorMessage.includes('budget') ||
        errorObj?.message?.includes('budget')
      ) {
        return {
          success: false,
          error: 'Erreur lors de la création de votre budget initial.',
        };
      }

      return {
        success: false,
        error: "Une erreur inattendue s'est produite",
      };
    }
  }

  #createTemplateFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ) {
    return this.#http.post<BudgetTemplateCreateResponse>(
      `${this.#applicationConfig.backendApiUrl()}/budget-templates/from-onboarding`,
      onboardingData,
    );
  }
}
