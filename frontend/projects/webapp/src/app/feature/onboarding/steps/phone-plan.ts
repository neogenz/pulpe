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
  selector: 'pulpe-phone-plan',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant de tes frais téléphoniques"
        [(value)]="phonePlanValue"
        (valueChange)="onPhonePlanChange()"
      />
    </div>
  `,
})
export default class PhonePlan implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 6,
  };

  public phonePlanValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return this.phonePlanValue() !== null && this.phonePlanValue()! >= 0;
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingPhonePlan = this.#onboardingApi.getStateData().phonePlan;
    if (existingPhonePlan !== null) {
      this.phonePlanValue.set(existingPhonePlan);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/transport']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/leasing-credit']));
  }

  protected onPhonePlanChange(): void {
    this.#onboardingApi.updatePhonePlanStep(this.phonePlanValue());
  }
}
