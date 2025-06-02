import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import { OnboardingApi } from '@core/onboarding/onboarding-api';

@Component({
  selector: 'pulpe-registration',
  standalone: true,
  imports: [
    OnboardingLayout,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue()"
      nextButtonText="Je m'inscris"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <mat-form-field class="w-full" appearance="outline">
          <mat-label>Email</mat-label>
          <input
            matInput
            type="email"
            [value]="emailValue()"
            (input)="onEmailChange($event)"
            placeholder="Email"
          />
          <mat-icon matPrefix>email</mat-icon>
        </mat-form-field>
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Registration {
  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle:
      'Afin de pouvoir te reconnecter facilement et de pouvoir faire vivre ton budget, tu dois renseigner ton email.',
    currentStep: 8,
    totalSteps: 8,
  };

  protected emailValue = signal<string>('');

  constructor(
    private router: Router,
    private onboardingApi: OnboardingApi,
  ) {
    const currentEmail = this.onboardingApi.onboardingData().email;
    if (currentEmail) {
      this.emailValue.set(currentEmail);
    }
  }

  protected canContinue(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.emailValue());
  }

  protected onEmailChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const email = target.value;
    this.emailValue.set(email);
    this.onboardingApi.updateEmail(email);
  }

  protected navigateNext(): void {
    this.onboardingApi.submitOnboardingData().subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        console.error('Error saving onboarding data:', error);
      },
    });
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/transport']);
  }
}
