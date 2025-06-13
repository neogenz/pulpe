import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  OnInit,
  effect,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingLayoutData } from '../models/onboarding-step';
import { OnboardingCurrencyInput } from '../ui/currency-input';
import { OnboardingApi } from '../onboarding-api';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'pulpe-health-insurance',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Frais d'assurances maladie"
        [(value)]="healthInsuranceValue"
        (valueChange)="onHealthInsuranceChange()"
      />
    </div>
  `,
})
export default class HealthInsurance implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
  };

  public healthInsuranceValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return (
      this.healthInsuranceValue() !== null && this.healthInsuranceValue()! >= 0
    );
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });

    const existingHealthInsurance =
      this.#onboardingApi.getStateData().healthInsurance;
    if (existingHealthInsurance !== null) {
      this.healthInsuranceValue.set(existingHealthInsurance);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/leasing-credit']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/housing']));
  }

  protected onHealthInsuranceChange(): void {
    this.#onboardingApi.updateHealthInsuranceStep(this.healthInsuranceValue());
  }
}
