import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import {
  OnboardingLayoutData,
  OnboardingStep,
} from '@features/onboarding/onboarding-step';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-health-insurance',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Frais d'assurances maladie"
        [(value)]="healthInsuranceValue"
        (valueChange)="onHealthInsuranceChange()"
      />
    </div>
  `,
})
export default class HealthInsurance implements OnboardingStep {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public healthInsuranceValue = signal<number | null>(null);

  constructor() {
    const existingHealthInsurance =
      this.onboardingApi.getStateData().healthInsurance;
    if (existingHealthInsurance !== null) {
      this.healthInsuranceValue.set(existingHealthInsurance);
    }
  }

  public canContinue = computed(() => {
    return (
      this.healthInsuranceValue() !== null && this.healthInsuranceValue()! >= 0
    );
  });

  protected onHealthInsuranceChange(): void {
    this.onboardingApi.updateHealthInsuranceStep(this.healthInsuranceValue());
  }
}
