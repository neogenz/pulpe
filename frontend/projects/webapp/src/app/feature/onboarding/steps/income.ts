import {
  Component,
  ChangeDetectionStrategy,
  model,
  inject,
  computed,
  afterNextRender,
  HostListener,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@core/routing';
import { OnboardingCurrencyInput } from '../ui/currency-input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingStore } from '../onboarding-store';

@Component({
  selector: 'pulpe-income',
  imports: [OnboardingCurrencyInput, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          Quels sont tes revenus mensuels ?
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Indique tes revenus nets mensuels pour calculer ton budget.
        </p>
      </div>

      <pulpe-onboarding-currency-input
        label="Revenus mensuels"
        [(value)]="incomeValue"
        [required]="true"
        testId="monthly-income-input"
        ariaDescribedBy="income-hint"
      />

      <div class="flex gap-4 p-4 md:p-0 w-full mt-auto">
        <button
          matButton="outlined"
          class="flex-1"
          data-testid="previous-button"
          (click)="onPrevious()"
        >
          Précédent
        </button>
        <button
          matButton="filled"
          color="primary"
          class="flex-1"
          [disabled]="!isValid()"
          data-testid="next-button"
          (click)="onNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class Income {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);

  protected readonly incomeValue = model<number | null>(null);

  protected readonly isValid = computed(() => {
    const value = this.incomeValue();
    return value !== null && value > 0;
  });

  constructor() {
    effect(() => {
      this.incomeValue.set(this.#store.data().monthlyIncome);
    });

    afterNextRender(() => {
      const input = document.querySelector(
        'input[type="number"]',
      ) as HTMLInputElement;
      input?.focus();
    });
  }

  @HostListener('keydown.enter')
  onEnter(): void {
    this.#handleNext();
  }

  onNext(): void {
    this.#handleNext();
  }

  onPrevious(): void {
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_PERSONAL_INFO,
    ]);
  }

  #handleNext(): void {
    if (!this.isValid()) {
      return;
    }

    this.#store.updateField('monthlyIncome', this.incomeValue());
    this.#router.navigate(['/', ROUTES.ONBOARDING, ROUTES.ONBOARDING_PAY_DAY]);
  }
}
