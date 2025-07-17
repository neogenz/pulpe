import {
  Component,
  ChangeDetectionStrategy,
  model,
  inject,
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
  selector: 'pulpe-health-insurance',
  imports: [OnboardingCurrencyInput, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          Frais d'assurances maladie
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Indique tes frais d'assurance maladie mensuels (optionnel).
        </p>
      </div>

      <pulpe-onboarding-currency-input
        label="Frais d'assurances maladie"
        [(value)]="healthInsuranceValue"
        placeholder="0 (optionnel)"
        [required]="false"
        testId="health-insurance-input"
      />

      <div class="flex gap-4 p-4 md:p-0 w-full mt-auto">
        <button
          mat-stroked-button
          class="flex-1"
          data-testid="previous-button"
          (click)="onPrevious()"
        >
          Précédent
        </button>
        <button
          mat-flat-button
          color="primary"
          class="flex-1"
          data-testid="next-button"
          (click)="onNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class HealthInsurance {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);

  protected readonly healthInsuranceValue = model<number | null>(null);

  constructor() {
    effect(() => {
      this.healthInsuranceValue.set(this.#store.data().healthInsurance);
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
    this.#router.navigate(['/', ROUTES.ONBOARDING, ROUTES.ONBOARDING_HOUSING]);
  }

  #handleNext(): void {
    this.#store.updateField(
      'healthInsurance',
      this.healthInsuranceValue() ?? 0,
    );
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_PHONE_PLAN,
    ]);
  }
}
