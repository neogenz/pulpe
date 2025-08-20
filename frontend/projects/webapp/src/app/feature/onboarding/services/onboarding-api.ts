import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';
import {
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';

@Injectable()
export class OnboardingApi {
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);

  /**
   * Creates a template from onboarding data
   * This is a specialized endpoint only used during the onboarding flow
   */
  createTemplateFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#http.post<BudgetTemplateCreateResponse>(
      `${this.#applicationConfig.backendApiUrl()}/budget-templates/from-onboarding`,
      onboardingData,
    );
  }
}
