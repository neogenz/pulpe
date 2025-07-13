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
  selector: 'pulpe-leasing-credit',
  imports: [OnboardingCurrencyInput, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de leasing ou crédits"
        [(value)]="leasingCreditValue"
        (valueChange)="onLeasingCreditChange()"
        placeholder="0 (optionnel)"
      />
    </div>
  `,
})
export default class LeasingCredit {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 7,
  };

  protected leasingCreditValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    const value = this.leasingCreditValue();
    return value === null || value >= 0; // Can be empty (fallback to 0) or >= 0
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingLeasingCredit = this.#onboardingStore.data().leasingCredit;
    if (existingLeasingCredit !== null) {
      this.leasingCreditValue.set(existingLeasingCredit);
    }
  }

  protected onLeasingCreditChange(): void {
    const value = this.leasingCreditValue();
    // Fallback to 0 if null for optional field
    this.#onboardingStore.updateField('leasingCredit', value ?? 0);
  }
}
