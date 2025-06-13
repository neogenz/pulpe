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
  OnboardingLayoutData,
  OnboardingStep,
} from '@features/onboarding/onboarding-step';
import {
  OnboardingApi,
  OnboardingStepData,
} from '@features/onboarding/onboarding-api';
import { BudgetApi } from '@core/budget';
import { AuthApi } from '@core/auth/auth-api';
import { ROUTES } from '@core/routing/routes-constants';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';
import { BudgetCreateFromOnboarding } from '@pulpe/shared';

@Component({
  selector: 'pulpe-registration',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Email</mat-label>
        <input
          matInput
          type="email"
          placeholder="Email"
          required
          [(ngModel)]="emailValue"
          (ngModelChange)="updateOnboardingEmail()"
          [disabled]="isSubmitting()"
        />
        <mat-icon matPrefix>email</mat-icon>
      </mat-form-field>

      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Mot de passe</mat-label>
        <input
          matInput
          [type]="hidePassword() ? 'password' : 'text'"
          placeholder="Mot de passe"
          required
          [(ngModel)]="passwordValue"
          [disabled]="isSubmitting()"
        />
        <mat-icon matPrefix>lock</mat-icon>
        <button
          matIconButton
          matSuffix
          type="button"
          (click)="hidePassword.set(!hidePassword())"
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
    </div>
  `,
})
export default class Registration implements OnboardingStep {
  #router = inject(Router);
  #onboardingApi = inject(OnboardingApi);
  #budgetApi = inject(BudgetApi);
  #authService = inject(AuthApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle: 'Créez votre compte pour accéder à votre budget personnalisé.',
    currentStep: 8,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public emailValue = signal<string>('');
  public passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);
  public isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  public canContinue = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(this.emailValue());
    const isPasswordValid = this.passwordValue().length >= 8;
    return isEmailValid && isPasswordValid;
  });

  constructor() {
    const currentEmail = this.#onboardingApi.getStateData().email;
    if (currentEmail) {
      this.emailValue.set(currentEmail);
    }
  }

  protected updateOnboardingEmail(): void {
    const currentSteps = this.#onboardingApi.getStateData();
    this.#onboardingApi.updatePersonalInfoStep(
      currentSteps.firstName,
      this.emailValue(),
    );
  }

  public async onNext(): Promise<void> {
    if (!this.canContinue() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const authResult = await this.#authService.signUpWithEmail(
        this.emailValue(),
        this.passwordValue(),
      );

      if (!authResult.success) {
        this.errorMessage.set(
          authResult.error || 'Erreur lors de la création du compte',
        );
        return;
      }

      const onboardingPayload = this.#onboardingApi.getStateData();
      const budgetRequest = this.#buildBudgetCreationRequest(onboardingPayload);
      await firstValueFrom(
        this.#budgetApi.createBudgetFromOnboarding$(budgetRequest),
      );

      this.#onboardingApi.submitCompletedOnboarding();
      this.#onboardingApi.clearOnboardingData();

      this.successMessage.set(
        'Votre compte a été créé avec succès ! Redirection vers votre budget...',
      );

      setTimeout(() => this.#router.navigate([ROUTES.CURRENT_MONTH]), 2000);
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  #buildBudgetCreationRequest(
    payload: OnboardingStepData,
  ): BudgetCreateFromOnboarding {
    const currentDate = new Date();
    return {
      monthlyIncome: payload.monthlyIncome ?? 0,
      housingCosts: payload.housingCosts ?? 0,
      healthInsurance: payload.healthInsurance ?? 0,
      leasingCredit: payload.leasingCredit ?? 0,
      phonePlan: payload.phonePlan ?? 0,
      transportCosts: payload.transportCosts ?? 0,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      description: `Budget initial de ${
        payload.firstName
      } pour ${currentDate.getFullYear()}`,
    };
  }
}
