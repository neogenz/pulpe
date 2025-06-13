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
  selector: 'pulpe-leasing-credit',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de leasing ou crédits"
        [(value)]="leasingCreditValue"
        (valueChange)="onLeasingCreditChange()"
      />
    </div>
  `,
})
export default class LeasingCredit implements OnboardingStep {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 5,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public leasingCreditValue = signal<number | null>(null);

  constructor() {
    const existingLeasingCredit =
      this.onboardingApi.getStateData().leasingCredit;
    if (existingLeasingCredit !== null) {
      this.leasingCreditValue.set(existingLeasingCredit);
    }
  }

  public canContinue = computed(() => {
    return (
      this.leasingCreditValue() !== null && this.leasingCreditValue()! >= 0
    );
  });

  protected onLeasingCreditChange(): void {
    this.onboardingApi.updateLeasingCreditStep(this.leasingCreditValue());
  }
}
