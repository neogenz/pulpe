import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingLayout, OnboardingLayoutData } from '../onboarding-layout';
import { OnboardingCurrencyInput } from '../currency-input';

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
  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 6,
    totalSteps: 8,
  };

  protected phonePlanValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.phonePlanValue() !== null && this.phonePlanValue()! >= 0;
  }

  protected onPhonePlanChange(value: number | null): void {
    this.phonePlanValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/transport']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/leasing-credit']);
  }
}
