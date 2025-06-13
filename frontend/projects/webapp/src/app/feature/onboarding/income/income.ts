import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { OnboardingLayoutData } from '@features/onboarding/onboarding-layout';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-income',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Revenus mensuels"
        [(value)]="incomeValue"
        (valueChange)="onIncomeChange()"
      />
    </div>
  `,
})
export default class Income {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Quel est le montant de tes revenus mensuels ?',
    subtitle:
      "Tes revenus mensuels correspondent par exemple à ton salaire, tes rentes, etc. Je vais l'utiliser pour calculer ton budget de base. On pourra le modifier par la suite.",
    currentStep: 2,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public incomeValue = signal<number | null>(null);

  constructor() {
    const existingIncome = this.onboardingApi.getStateData().monthlyIncome;
    if (existingIncome !== null) {
      this.incomeValue.set(existingIncome);
    }
  }

  public canContinue = computed(() => {
    return this.incomeValue() !== null && this.incomeValue()! > 0;
  });

  protected onIncomeChange(): void {
    this.onboardingApi.updateIncomeStep(this.incomeValue());
  }
}
