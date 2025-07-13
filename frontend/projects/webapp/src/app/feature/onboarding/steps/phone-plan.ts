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
export default class PhonePlan {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 6,
  };

  public phonePlanValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    return this.phonePlanValue() !== null && this.phonePlanValue()! >= 0;
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingPhonePlan = this.#onboardingStore.data().phonePlan;
    if (existingPhonePlan !== null) {
      this.phonePlanValue.set(existingPhonePlan);
    }
  }

  protected onPhonePlanChange(): void {
    this.#onboardingStore.updateField('phonePlan', this.phonePlanValue());
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/transport']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/leasing-credit']);
  }
}
