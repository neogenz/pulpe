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
  selector: 'pulpe-housing',
  imports: [OnboardingCurrencyInput, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de ton loyer"
        [(value)]="housingValue"
        (valueChange)="onHousingChange()"
        ariaDescribedBy="housing-hint"
      />
    </div>
  `,
})
export default class Housing {
  readonly #onboardingStore = inject(OnboardingStore);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
  };

  protected housingValue = signal<number | null>(null);

  readonly canContinue = computed(() => {
    const value = this.housingValue();
    return value === null || value >= 0; // Housing costs can be 0 (owner, staying with family, etc.)
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
}
