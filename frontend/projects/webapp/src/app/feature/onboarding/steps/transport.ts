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
export default class Transport {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
  };

  public transportValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    return this.transportValue() !== null && this.transportValue()! >= 0;
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
    this.#onboardingStore.updateField('transportCosts', this.transportValue());
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/registration']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/phone-plan']);
  }
}
