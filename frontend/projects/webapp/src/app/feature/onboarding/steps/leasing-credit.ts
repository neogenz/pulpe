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
export default class LeasingCredit {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 5,
  };

  public leasingCreditValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    return (
      this.leasingCreditValue() !== null && this.leasingCreditValue()! >= 0
    );
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
    this.#onboardingStore.updateField(
      'leasingCredit',
      this.leasingCreditValue(),
    );
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/phone-plan']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/health-insurance']);
  }
}
