import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { TextInputComponent } from '../../../ui/text-input/text-input';

@Component({
  selector: 'pulpe-registration',
  standalone: true,
  imports: [OnboardingCardComponent, TextInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      nextButtonText="Je m'inscris"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-text-input
          [value]="emailValue()"
          [icon]="true"
          type="email"
          placeholder="Email"
          (valueChange)="onEmailChange($event)"
        >
          <span slot="icon" class="material-icons text-gray-500">email</span>
        </pulpe-text-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class RegistrationComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Presque fini !',
    subtitle:
      'Afin de pouvoir te reconnecter facilement et de pouvoir faire vivre ton budget, tu dois renseigner ton email.',
    currentStep: 8,
    totalSteps: 8,
  };

  protected emailValue = signal<string>('');

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.emailValue());
  }

  protected onEmailChange(value: string): void {
    this.emailValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/home']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/transport']);
  }
}
