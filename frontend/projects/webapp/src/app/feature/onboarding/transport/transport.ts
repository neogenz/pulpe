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
  selector: 'pulpe-transport',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant d'abonnements"
        [(value)]="transportValue"
        (valueChange)="onTransportChange()"
      />
    </div>
  `,
})
export default class Transport {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public transportValue = signal<number | null>(null);

  constructor() {
    const existingTransport = this.onboardingApi.getStateData().transportCosts;
    if (existingTransport !== null) {
      this.transportValue.set(existingTransport);
    }
  }

  public canContinue = computed(() => {
    return this.transportValue() !== null && this.transportValue()! >= 0;
  });

  protected onTransportChange(): void {
    this.onboardingApi.updateTransportStep(this.transportValue());
  }
}
