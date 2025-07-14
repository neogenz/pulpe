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
import { OnboardingCurrencyInput } from '../ui/currency-input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingStore } from '../onboarding-store';

@Component({
  selector: 'pulpe-housing',
  imports: [OnboardingCurrencyInput, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          Quel est le montant de ton loyer ?
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Indique le montant de ton loyer mensuel (optionnel).
        </p>
      </div>

      <pulpe-onboarding-currency-input
        label="Montant de ton loyer"
        [(value)]="housingValue"
        placeholder="0 (optionnel)"
        [required]="false"
        ariaDescribedBy="housing-hint"
        testId="housing-costs-input"
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
export default class Housing {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);

  protected readonly housingValue = model<number | null>(null);

  constructor() {
    effect(() => {
      this.housingValue.set(this.#store.data().housingCosts);
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
    this.#router.navigate(['/onboarding/income']);
  }

  #handleNext(): void {
    this.#store.updateField('housingCosts', this.housingValue() ?? 0);
    this.#router.navigate(['/onboarding/health-insurance']);
  }
}
