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
  selector: 'pulpe-housing',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de ton loyer"
        [(value)]="housingValue"
        (valueChange)="onHousingChange()"
      />
    </div>
  `,
})
export default class Housing implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public housingValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return this.housingValue() !== null && this.housingValue()! > 0;
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingHousing = this.#onboardingApi.getStateData().housingCosts;
    if (existingHousing !== null) {
      this.housingValue.set(existingHousing);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/health-insurance']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/income']));
  }

  protected onHousingChange(): void {
    this.#onboardingApi.updateHousingStep(this.housingValue());
  }
}
