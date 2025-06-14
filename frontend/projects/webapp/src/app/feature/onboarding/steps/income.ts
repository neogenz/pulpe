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
import { OnboardingLayoutData } from '../models/onboarding-layout-data';
import { OnboardingCurrencyInput } from '../ui/currency-input';
import { OnboardingApi } from '../onboarding-api';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'pulpe-income',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Revenus mensuels"
        [(value)]="incomeValue"
        (valueChange)="onIncomeChange()"
      />
    </div>
  `,
})
export default class Income implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Quel est le montant de tes revenus mensuels ?',
    subtitle:
      "Tes revenus mensuels correspondent par exemple à ton salaire, tes rentes, etc. Je vais l'utiliser pour calculer ton budget de base. On pourra le modifier par la suite.",
    currentStep: 2,
  };

  public incomeValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return this.incomeValue() !== null && this.incomeValue()! > 0;
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingIncome = this.#onboardingApi.getStateData().monthlyIncome;
    if (existingIncome !== null) {
      this.incomeValue.set(existingIncome);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/housing']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/personal-info']));
  }

  protected onIncomeChange(): void {
    this.#onboardingApi.updateIncomeStep(this.incomeValue());
  }
}
