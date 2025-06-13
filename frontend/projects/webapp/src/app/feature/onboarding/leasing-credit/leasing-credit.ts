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
import { OnboardingLayoutData } from '@features/onboarding/onboarding-step';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';
import { OnboardingOrchestrator } from '../onboarding.orchestrator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'pulpe-leasing-credit',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de leasing ou crédits"
        [(value)]="leasingCreditValue"
        (valueChange)="onLeasingCreditChange()"
      />
    </div>
  `,
})
export default class LeasingCredit implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 5,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public leasingCreditValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return (
      this.leasingCreditValue() !== null && this.leasingCreditValue()! >= 0
    );
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingLeasingCredit =
      this.#onboardingApi.getStateData().leasingCredit;
    if (existingLeasingCredit !== null) {
      this.leasingCreditValue.set(existingLeasingCredit);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/phone-plan']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/health-insurance']));
  }

  protected onLeasingCreditChange(): void {
    this.#onboardingApi.updateLeasingCreditStep(this.leasingCreditValue());
  }
}
