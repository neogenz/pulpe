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
  selector: 'pulpe-transport',
  imports: [OnboardingCurrencyInput, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant d'abonnements"
        [(value)]="transportValue"
        (valueChange)="onTransportChange()"
        placeholder="0 (optionnel)"
      />
    </div>
  `,
})
export default class Transport {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
  };

  protected transportValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    const value = this.transportValue();
    return value === null || value >= 0; // Can be empty (fallback to 0) or >= 0
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingTransport = this.#onboardingStore.data().transportCosts;
    if (existingTransport !== null) {
      this.transportValue.set(existingTransport);
    }
  }

  protected onTransportChange(): void {
    const value = this.transportValue();
    // Fallback to 0 if null for optional field
    this.#onboardingStore.updateField('transportCosts', value ?? 0);
  }
}
