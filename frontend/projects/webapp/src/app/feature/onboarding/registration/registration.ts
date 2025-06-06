import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import {
  OnboardingApi,
  OnboardingSubmissionPayload,
} from '@core/onboarding/onboarding-api';
import { BudgetApi, CreateOnboardingBudgetRequest } from '@core/budget';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

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
      (next)="completeOnboardingAndCreateBudget()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <mat-form-field class="w-full" appearance="fill">
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
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);
  private readonly budgetApi = inject(BudgetApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle:
      'Afin de pouvoir te reconnecter facilement et de pouvoir faire vivre ton budget, tu dois renseigner ton email.',
    currentStep: 8,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected emailValue = signal<string>('');

  constructor() {
    const currentEmail = this.onboardingApi.onboardingSteps().email;
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
    const currentSteps = this.onboardingApi.onboardingSteps();
    this.onboardingApi.updatePersonalInfoStep(currentSteps.firstName, email);
  }

  protected async completeOnboardingAndCreateBudget(): Promise<void> {
    this.onboardingApi.submitCompletedOnboarding();
    const onboardingPayload =
      this.onboardingApi.getOnboardingSubmissionPayload();
    const budgetRequest = this.#buildBudgetCreationRequest(onboardingPayload);
    await firstValueFrom(
      this.budgetApi.createOnboardingBudget$(budgetRequest),
    );
    this.router.navigate(['/app']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/transport']);
  }

  #buildBudgetCreationRequest(
    payload: OnboardingSubmissionPayload,
  ): CreateOnboardingBudgetRequest {
    return {
      monthlyIncome: payload.monthlyIncome,
      housingCosts: payload.housingCosts,
      healthInsurance: payload.healthInsurance,
      leasingCredit: payload.leasingCredit,
      phonePlan: payload.phonePlan,
      transportCosts: payload.transportCosts,
      firstName: payload.firstName,
      email: payload.email,
    };
  }
}
