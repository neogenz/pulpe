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
  selector: 'pulpe-transport',
  imports: [OnboardingCurrencyInput, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          Quels sont tes frais de transport ?
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Indique le montant de tes abonnements de transport mensuels.
        </p>
      </div>

      <pulpe-onboarding-currency-input
        label="Montant d'abonnements"
        [(value)]="transportValue"
        placeholder="0 (optionnel)"
        [required]="false"
        testId="transport-costs-input"
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
          data-testid="next-button"
          (click)="onNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class Transport {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);

  protected readonly transportValue = model<number | null>(null);

  constructor() {
    effect(() => {
      this.transportValue.set(this.#store.data().transportCosts);
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
    this.#router.navigate(['/onboarding/phone-plan']);
  }

  #handleNext(): void {
    this.#store.updateField('transportCosts', this.transportValue() ?? 0);
    this.#router.navigate(['/onboarding/leasing-credit']);
  }
}
