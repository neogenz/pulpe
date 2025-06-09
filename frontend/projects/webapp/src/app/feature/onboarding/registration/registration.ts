import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import {
  OnboardingApi,
  OnboardingSubmissionPayload,
} from '@features/onboarding/onboarding-api';
import { BudgetApi, CreateOnboardingBudgetRequest } from '@core/budget';
import { AuthApi } from '@core/auth/auth-api';
import { ROUTES } from '@core/routing/routes-constants';
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
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue() && !isSubmitting()"
      [nextButtonText]="nextButtonText()"
      (next)="registerAndCreateAccount()"
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
            [disabled]="isSubmitting()"
          />
          <mat-icon matPrefix>email</mat-icon>
        </mat-form-field>

        <mat-form-field class="w-full" appearance="fill">
          <mat-label>Mot de passe</mat-label>
          <input
            matInput
            [type]="hidePassword() ? 'password' : 'text'"
            [value]="passwordValue()"
            (input)="onPasswordChange($event)"
            placeholder="Mot de passe"
            [disabled]="isSubmitting()"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            matIconButton
            matSuffix
            type="button"
            (click)="togglePasswordVisibility()"
            [attr.aria-label]="'Afficher le mot de passe'"
            [attr.aria-pressed]="!hidePassword()"
          >
            <mat-icon>{{
              hidePassword() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-hint
            >Le mot de passe doit contenir au minimum 8 caractères</mat-hint
          >
        </mat-form-field>

        @if (errorMessage()) {
          <div
            class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
          >
            {{ errorMessage() }}
          </div>
        }

        @if (successMessage()) {
          <div
            class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded"
          >
            {{ successMessage() }}
          </div>
        }
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Registration {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);
  private readonly budgetApi = inject(BudgetApi);
  private readonly authService = inject(AuthApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle: 'Créez votre compte pour accéder à votre budget personnalisé.',
    currentStep: 8,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected emailValue = signal<string>('');
  protected passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  protected nextButtonText = computed(() =>
    this.isSubmitting() ? 'Création en cours...' : "Je m'inscris",
  );

  constructor() {
    const currentEmail = this.onboardingApi.onboardingSteps().email;
    if (currentEmail) {
      this.emailValue.set(currentEmail);
    }
  }

  protected canContinue(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(this.emailValue());
    const isPasswordValid = this.passwordValue().length >= 8;
    return isEmailValid && isPasswordValid;
  }

  protected onEmailChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const email = target.value;
    this.emailValue.set(email);
    const currentSteps = this.onboardingApi.onboardingSteps();
    this.onboardingApi.updatePersonalInfoStep(currentSteps.firstName, email);
  }

  protected onPasswordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.passwordValue.set(target.value);
  }

  protected togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  protected async registerAndCreateAccount(): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const authResult = await this.authService.signUpWithEmail(
        this.emailValue(),
        this.passwordValue(),
      );

      if (!authResult.success) {
        this.errorMessage.set(
          authResult.error || 'Erreur lors de la création du compte',
        );
        return;
      }

      const onboardingPayload =
        this.onboardingApi.getOnboardingSubmissionPayload();
      const budgetRequest = this.#buildBudgetCreationRequest(onboardingPayload);

      await firstValueFrom(
        this.budgetApi.createOnboardingBudget$(budgetRequest),
      );

      this.onboardingApi.submitCompletedOnboarding();
      this.onboardingApi.clearOnboardingData();

      this.successMessage.set(
        'Votre compte a été créé avec succès ! Redirection vers votre budget...',
      );

      setTimeout(() => {
        this.router.navigate([ROUTES.CURRENT_MONTH]);
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
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
