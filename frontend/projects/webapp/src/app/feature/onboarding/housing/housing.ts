import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../onboarding-card/onboarding-card';
import { OnboardingCurrencyInputComponent } from '../currency-input';

@Component({
  selector: 'pulpe-housing',
  standalone: true,
  imports: [OnboardingCardComponent, OnboardingCurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-onboarding-currency-input
          label="Montant de ton loyer"
          [value]="housingValue()"
          (valueChange)="onHousingChange($event)"
        />
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class HousingComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
    totalSteps: 8,
  };

  protected housingValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.housingValue() !== null && this.housingValue()! > 0;
  }

  protected onHousingChange(value: number | null): void {
    this.housingValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/health-insurance']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/income']);
  }
}
