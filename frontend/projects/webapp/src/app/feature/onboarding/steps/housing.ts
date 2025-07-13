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
export default class Housing {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
  };

  public housingValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    return this.housingValue() !== null && this.housingValue()! > 0;
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingHousing = this.#onboardingStore.data().housingCosts;
    if (existingHousing !== null) {
      this.housingValue.set(existingHousing);
    }
  }

  protected onHousingChange(): void {
    this.#onboardingStore.updateField('housingCosts', this.housingValue());
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/health-insurance']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/income']);
  }
}
