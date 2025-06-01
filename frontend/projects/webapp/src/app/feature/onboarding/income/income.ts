import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { CurrencyInputComponent } from '../../../ui/currency-input/currency-input';

@Component({
  selector: 'pulpe-income',
  standalone: true,
  imports: [OnboardingCardComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-currency-input
          [value]="incomeValue()"
          [placeholder]="'Revenus mensuels'"
          (valueChange)="onIncomeChange($event)"
        >
        </pulpe-currency-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class IncomeComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Quel est le montant de tes revenus mensuels ?',
    subtitle:
      "Tes revenus mensuels correspondent par exemple à ton salaire, tes rentes, etc. Je vais l'utiliser pour calculer ton budget de base. On pourra le modifier par la suite.",
    currentStep: 1,
    totalSteps: 8,
  };

  protected incomeValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.incomeValue() !== null && this.incomeValue()! > 0;
  }

  protected onIncomeChange(value: number | null): void {
    this.incomeValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/housing']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/welcome']);
  }
}
