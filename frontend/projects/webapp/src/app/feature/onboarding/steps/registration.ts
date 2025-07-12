import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  OnInit,
  signal,
  afterNextRender,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { ROUTES } from '@core/routing/routes-constants';
import { OnboardingLayoutData } from '../models/onboarding-layout-data';
import { OnboardingApi } from '../onboarding-api';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';
import { RegistrationState } from './registration-state';

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
          [disabled]="
            onboardingApi.isSubmitting() || isAuthenticationCompleted()
          "
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
          [disabled]="
            onboardingApi.isSubmitting() || isAuthenticationCompleted()
          "
        />
        <mat-icon matPrefix>lock</mat-icon>
        <button
          matIconButton
          matSuffix
          type="button"
          (click)="hidePassword.set(!hidePassword())"
          [attr.aria-label]="'Afficher le mot de passe'"
          [attr.aria-pressed]="!hidePassword()"
          [disabled]="isAuthenticationCompleted()"
        >
          <mat-icon>{{
            hidePassword() ? 'visibility_off' : 'visibility'
          }}</mat-icon>
        </button>
        <mat-hint
          >Le mot de passe doit contenir au minimum 8 caractères</mat-hint
        >
      </mat-form-field>

      @if (isAuthenticationCompleted()) {
        <div
          class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded"
        >
          ✅ Compte créé avec succès. Finalisation en cours...
        </div>
      }

      @if (onboardingApi.submissionError()) {
        <div
          class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
        >
          {{ onboardingApi.submissionError() }}
        </div>
      }
      @if (onboardingApi.submissionSuccess()) {
        <div
          class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded"
        >
          {{ onboardingApi.submissionSuccess() }}
        </div>
      }
    </div>
  `,
})
export default class Registration implements OnInit {
  #router = inject(Router);
  #elementRef = inject(ElementRef);
  protected readonly onboardingApi = inject(OnboardingApi);
  #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);
  readonly #registrationState = inject(RegistrationState);

  readonly #onboardingLayoutData = computed<OnboardingLayoutData>(() => {
    const isRetry =
      this.#registrationState.processState().completedSteps.length > 0;
    return {
      title: isRetry ? 'Reprise du processus' : 'Presque fini !',
      subtitle: isRetry
        ? 'Finalisons la création de votre compte.'
        : 'Créez votre compte pour accéder à votre budget personnalisé.',
      currentStep: 8,
    };
  });

  public emailValue = linkedSignal<string>(
    () => this.onboardingApi.getStateData().email,
  );
  public passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);

  // Use the onboarding API's validation logic
  public canContinue = computed(() => {
    // If authentication is already completed, we can continue without password validation
    if (this.#registrationState.isAuthenticationCompleted()) {
      return true;
    }

    const password = this.passwordValue();
    return this.onboardingApi.canSubmitRegistration(password);
  });

  // Template-accessible getters
  protected isAuthenticationCompleted =
    this.#registrationState.isAuthenticationCompleted;

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.canContinue());
      this.#orchestrator.isSubmitting.set(this.onboardingApi.isSubmitting());
      this.#orchestrator.layoutData.set(this.#onboardingLayoutData());
      this.#orchestrator.nextButtonText.set(
        this.#registrationState.retryButtonText(),
      );
    });

    afterNextRender(() => {
      this.#elementRef.nativeElement
        .querySelector('input[type="email"]')
        ?.focus();
    });
  }

  ngOnInit(): void {
    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.registerAndCreateAccount());

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/transport']));
  }

  protected updateOnboardingEmail(): void {
    const currentSteps = this.onboardingApi.getStateData();
    this.onboardingApi.updatePersonalInfoStep(
      currentSteps.firstName,
      this.emailValue(),
    );
  }

  private async registerAndCreateAccount(): Promise<void> {
    if (!this.canContinue() || this.onboardingApi.isSubmitting()) return;

    // Delegate the business logic to the service
    const result = await this.#registrationState.processCompleteRegistration(
      this.emailValue(),
      this.passwordValue(),
    );

    // Component handles navigation based on result
    if (result.success) {
      this.#router.navigate([ROUTES.CURRENT_MONTH]);
    }
  }
}
