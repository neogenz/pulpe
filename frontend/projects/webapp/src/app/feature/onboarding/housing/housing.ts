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
  selector: 'pulpe-housing',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de ton loyer"
        [(value)]="housingValue"
        (valueChange)="onHousingChange()"
      />
    </div>
  `,
})
export default class Housing {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public housingValue = signal<number | null>(null);

  constructor() {
    const existingHousing = this.onboardingApi.getStateData().housingCosts;
    if (existingHousing !== null) {
      this.housingValue.set(existingHousing);
    }
  }

  public canContinue = computed(() => {
    return this.housingValue() !== null && this.housingValue()! > 0;
  });

  protected onHousingChange(): void {
    this.onboardingApi.updateHousingStep(this.housingValue());
  }
}
