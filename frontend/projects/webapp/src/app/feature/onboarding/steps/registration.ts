import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthApi } from '@core/auth/auth-api';
import { BudgetApi } from '@core/budget';
import { ROUTES } from '@core/routing/routes-constants';
import {
  BudgetCreateFromTemplate,
  BudgetTemplateCreateFromOnboarding,
} from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import { TemplateApi } from '@core/template';
import { OnboardingLayoutData } from '../models/onboarding-layout-data';
import { OnboardingApi, OnboardingStepData } from '../onboarding-api';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';

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
  `,
})
export default class Registration implements OnInit {
  #router = inject(Router);
  #onboardingApi = inject(OnboardingApi);
  #budgetApi = inject(BudgetApi);
  #templateApi = inject(TemplateApi);
  #authService = inject(AuthApi);
  #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle: 'Créez votre compte pour accéder à votre budget personnalisé.',
    currentStep: 8,
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
    effect(() => {
      this.#orchestrator.canContinue.set(this.canContinue());
      this.#orchestrator.isSubmitting.set(this.isSubmitting());
    });

    const currentEmail = this.#onboardingApi.getStateData().email;
    if (currentEmail) {
      this.emailValue.set(currentEmail);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.registerAndCreateAccount());

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/transport']));
  }

  protected updateOnboardingEmail(): void {
    const currentSteps = this.#onboardingApi.getStateData();
    this.#onboardingApi.updatePersonalInfoStep(
      currentSteps.firstName,
      this.emailValue(),
    );
  }

  private async registerAndCreateAccount(): Promise<void> {
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

      const templateRequest =
        this.#buildTemplateCreationRequest(onboardingPayload);
      const templateResponse = await firstValueFrom(
        this.#templateApi.createFromOnboarding$(templateRequest),
      );

      const budgetRequest = this.#buildBudgetFromTemplateRequest(
        onboardingPayload,
        templateResponse.data.template.id,
      );
      await firstValueFrom(
        this.#budgetApi.createBudgetFromTemplate$(budgetRequest),
      );

      this.#onboardingApi.submitCompletedOnboarding();
      this.#onboardingApi.clearOnboardingData();

      this.successMessage.set(
        'Votre compte a été créé avec succès ! Redirection vers votre budget...',
      );

      this.#router.navigate([ROUTES.CURRENT_MONTH]);
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  #buildTemplateCreationRequest(
    payload: OnboardingStepData,
  ): BudgetTemplateCreateFromOnboarding {
    return {
      name: 'Mois Standard',
      description: `Template personnel de ${payload.firstName}`,
      isDefault: true,
      monthlyIncome: payload.monthlyIncome ?? 0,
      housingCosts: payload.housingCosts ?? 0,
      healthInsurance: payload.healthInsurance ?? 0,
      leasingCredit: payload.leasingCredit ?? 0,
      phonePlan: payload.phonePlan ?? 0,
      transportCosts: payload.transportCosts ?? 0,
      customTransactions: [],
    };
  }

  #buildBudgetFromTemplateRequest(
    payload: OnboardingStepData,
    templateId: string,
  ): BudgetCreateFromTemplate {
    const currentDate = new Date();
    return {
      templateId,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      description: `Budget initial de ${
        payload.firstName
      } pour ${currentDate.getFullYear()}`,
    };
  }
}
