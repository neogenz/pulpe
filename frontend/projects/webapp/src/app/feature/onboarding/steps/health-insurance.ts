import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingCurrencyInput } from '../ui/currency-input';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';

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

      <div class="flex justify-between">
        <button
          type="button"
          class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
          (click)="goToPrevious()"
        >
          Précédent
        </button>
        <button
          type="button"
          class="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="!canContinue()"
          (click)="goToNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class HealthInsurance {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
  };

  public healthInsuranceValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    return (
      this.healthInsuranceValue() !== null && this.healthInsuranceValue()! >= 0
    );
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
    this.#onboardingStore.updateField(
      'healthInsurance',
      this.healthInsuranceValue(),
    );
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/leasing-credit']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/housing']);
  }
}
