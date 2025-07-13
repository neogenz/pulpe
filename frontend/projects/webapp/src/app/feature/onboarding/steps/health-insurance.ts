import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingCurrencyInput } from '../ui/currency-input';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';

@Component({
  selector: 'pulpe-health-insurance',
  imports: [OnboardingCurrencyInput, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Frais d'assurances maladie"
        [(value)]="healthInsuranceValue"
        (valueChange)="onHealthInsuranceChange()"
        placeholder="0 (optionnel)"
      />
    </div>
  `,
})
export default class HealthInsurance {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
  };

  protected healthInsuranceValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    const value = this.healthInsuranceValue();
    return value === null || value >= 0; // Can be empty (fallback to 0) or >= 0
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingHealthInsurance =
      this.#onboardingStore.data().healthInsurance;
    if (existingHealthInsurance !== null) {
      this.healthInsuranceValue.set(existingHealthInsurance);
    }
  }

  protected onHealthInsuranceChange(): void {
    const value = this.healthInsuranceValue();
    // Fallback to 0 if null for optional field
    this.#onboardingStore.updateField('healthInsurance', value ?? 0);
  }
}
