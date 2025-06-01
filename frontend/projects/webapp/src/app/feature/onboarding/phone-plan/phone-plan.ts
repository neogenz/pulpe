import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { CurrencyInputComponent } from '../../../ui/currency-input/currency-input';

@Component({
  selector: 'pulpe-phone-plan',
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
          [value]="phonePlanValue()"
          placeholder="Montant de tes frais téléphoniques"
          (valueChange)="onPhonePlanChange($event)"
        >
        </pulpe-currency-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class PhonePlanComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Forfait téléphone ?',
    subtitle:
      'Combien payes-tu frais téléphoniques chaque mois ? (Par ex. Swisscom, Sunrise, etc...)',
    currentStep: 5,
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
