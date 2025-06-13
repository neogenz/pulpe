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
  selector: 'pulpe-transport',
  standalone: true,
  imports: [OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <pulpe-onboarding-currency-input
        label="Montant d'abonnements"
        [(value)]="transportValue"
        (valueChange)="onTransportChange()"
      />
    </div>
  `,
})
export default class Transport implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
  };

  public transportValue = signal<number | null>(null);

  readonly #canContinue = computed(() => {
    return this.transportValue() !== null && this.transportValue()! >= 0;
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingTransport = this.#onboardingApi.getStateData().transportCosts;
    if (existingTransport !== null) {
      this.transportValue.set(existingTransport);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/registration']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/phone-plan']));
  }

  protected onTransportChange(): void {
    this.#onboardingApi.updateTransportStep(this.transportValue());
  }
}
