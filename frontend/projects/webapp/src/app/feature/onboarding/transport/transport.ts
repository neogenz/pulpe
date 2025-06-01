import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { CurrencyInputComponent } from '../../../ui/currency-input/currency-input';

@Component({
  selector: 'pulpe-transport',
  standalone: true,
  imports: [OnboardingCardComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      [nextButtonText]="'Terminer'"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-currency-input
          [value]="transportValue()"
          placeholder="Montant d'abonnements"
          (valueChange)="onTransportChange($event)"
        >
        </pulpe-currency-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class TransportComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Transport public ?',
    subtitle:
      "Combien payes-tu d'abonnements à des transports publics chaque mois ?",
    currentStep: 7,
    totalSteps: 8,
  };

  protected transportValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.transportValue() !== null && this.transportValue()! >= 0;
  }

  protected onTransportChange(value: number | null): void {
    this.transportValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/registration']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/phone-plan']);
  }
}
