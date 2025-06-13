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
  selector: 'pulpe-phone-plan',
  standalone: true,
  imports: [OnboardingLayout, OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-onboarding-currency-input
          label="Montant de tes frais téléphoniques"
          [value]="phonePlanValue()"
          (valueChange)="onPhonePlanChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class PhonePlan {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 6,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected phonePlanValue = signal<number | null>(null);

  constructor() {
    const existingPhonePlan = this.onboardingApi.getStateData().phonePlan;
    if (existingPhonePlan !== null) {
      this.phonePlanValue.set(existingPhonePlan);
    }
  }

  protected canContinue(): boolean {
    return this.phonePlanValue() !== null && this.phonePlanValue()! >= 0;
  }

  protected onPhonePlanChange(value: number | null): void {
    this.phonePlanValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updatePhonePlanStep(this.phonePlanValue());
    this.router.navigate(['/onboarding/transport']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/leasing-credit']);
  }
}
