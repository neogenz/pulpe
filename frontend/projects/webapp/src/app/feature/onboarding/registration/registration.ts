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
import { MatButtonModule } from '@angular/material/button';
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
import { AuthService } from '@core/auth/auth.service';
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
      nextButtonText="{{isSubmitting() ? 'Envoi en cours...' : 'Je m'inscris'}}"
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
  private readonly authService = inject(AuthService);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle:
      "Nous allons t'envoyer un lien magique par email pour créer ton compte et accéder à ton budget personnalisé.",
    currentStep: 8,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected emailValue = signal<string>('');
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

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

  protected async registerAndCreateAccount(): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      // 1. Finaliser l'onboarding
      this.onboardingApi.submitCompletedOnboarding();

      // 2. Envoyer le magic link pour créer le compte
      const result = await this.authService.signInWithMagicLink(
        this.emailValue(),
      );

      if (!result.success) {
        this.errorMessage.set(
          result.error || "Erreur lors de l'envoi du lien magique",
        );
        return;
      }

      // 3. Créer le budget avec les données d'onboarding
      const onboardingPayload =
        this.onboardingApi.getOnboardingSubmissionPayload();
      const budgetRequest = this.#buildBudgetCreationRequest(onboardingPayload);

      await firstValueFrom(
        this.budgetApi.createOnboardingBudget$(budgetRequest),
      );

      // 4. Succès
      this.successMessage.set(
        'Un lien magique a été envoyé à votre email. Cliquez dessus pour accéder à votre budget !',
      );

      // 5. Rediriger vers une page d'attente ou continuer
      setTimeout(() => {
        this.router.navigate(['/auth/magic-link-sent'], {
          queryParams: { email: this.emailValue() },
        });
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
