import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-transport',
  standalone: true,
  imports: [OnboardingLayout, OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue()"
      [nextButtonText]="'Terminer'"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-onboarding-currency-input
          label="Montant d'abonnements"
          [value]="transportValue()"
          (valueChange)="onTransportChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Transport {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected transportValue = signal<number | null>(null);

  constructor() {
    const existingTransport = this.onboardingApi.getStateData().transportCosts;
    if (existingTransport !== null) {
      this.transportValue.set(existingTransport);
    }
  }

  protected canContinue(): boolean {
    return this.transportValue() !== null && this.transportValue()! >= 0;
  }

  protected onTransportChange(value: number | null): void {
    this.transportValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updateTransportStep(this.transportValue());
    this.router.navigate(['/onboarding/registration']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/phone-plan']);
  }
}
