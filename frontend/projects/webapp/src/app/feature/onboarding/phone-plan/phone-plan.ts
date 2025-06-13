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
  selector: 'pulpe-phone-plan',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de tes frais téléphoniques"
        [(value)]="phonePlanValue"
        (valueChange)="onPhonePlanChange()"
      />
    </div>
  `,
})
export default class PhonePlan {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 6,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public phonePlanValue = signal<number | null>(null);

  constructor() {
    const existingPhonePlan = this.onboardingApi.getStateData().phonePlan;
    if (existingPhonePlan !== null) {
      this.phonePlanValue.set(existingPhonePlan);
    }
  }

  public canContinue = computed(() => {
    return this.phonePlanValue() !== null && this.phonePlanValue()! >= 0;
  });

  protected onPhonePlanChange(): void {
    this.onboardingApi.updatePhonePlanStep(this.phonePlanValue());
  }
}
