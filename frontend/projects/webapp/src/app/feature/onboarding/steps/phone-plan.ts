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
  selector: 'pulpe-phone-plan',
  imports: [OnboardingCurrencyInput, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de tes frais téléphoniques"
        [(value)]="phonePlanValue"
        (valueChange)="onPhonePlanChange()"
        placeholder="0 (optionnel)"
      />
    </div>
  `,
})
export default class PhonePlan {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 5,
  };

  protected phonePlanValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    const value = this.phonePlanValue();
    return value === null || value >= 0; // Can be empty (fallback to 0) or >= 0
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
    const value = this.phonePlanValue();
    // Fallback to 0 if null for optional field
    this.#onboardingStore.updateField('phonePlan', value ?? 0);
  }
}
