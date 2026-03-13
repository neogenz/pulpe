import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthCredentialsService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { GoogleOAuthButton } from '@app/pattern/google-oauth';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { createFieldsMatchValidator } from '@core/validators';

@Component({
  selector: 'pulpe-signup',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatCheckboxModule,
    RouterLink,
    GoogleOAuthButton,
    ErrorAlert,
    LoadingButton,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-card w-full max-w-md">
      <button
        matButton
        [routerLink]="['/', ROUTES.WELCOME]"
        class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
      >
        <mat-icon class="text-lg">arrow_back</mat-icon>
        <span>{{ 'auth.signup.backToHome' | transloco }}</span>
      </button>

      <div class="text-center mb-8 mt-4">
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
        >
          {{ 'auth.signup.title' | transloco }}
        </h1>
        <p class="text-body-large text-on-surface-variant">
          {{ 'auth.signup.subtitle' | transloco }}
        </p>
      </div>

      <form
        [formGroup]="signupForm"
        (ngSubmit)="signUp()"
        class="space-y-4"
        data-testid="signup-form"
      >
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'form.emailLabel' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            formControlName="email"
            data-testid="email-input"
            (input)="clearMessages()"
            [placeholder]="'form.emailPlaceholder' | transloco"
            [disabled]="isSubmitting()"
          />
          <mat-icon matPrefix>email</mat-icon>
          @if (
            signupForm.get('email')?.invalid && signupForm.get('email')?.touched
          ) {
            <mat-error>
              @if (signupForm.get('email')?.hasError('required')) {
                {{ 'form.emailRequired' | transloco }}
              } @else if (signupForm.get('email')?.hasError('email')) {
                {{ 'form.emailInvalid' | transloco }}
              }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'form.passwordLabel' | transloco }}</mat-label>
          <input
            matInput
            [type]="isPasswordHidden() ? 'password' : 'text'"
            formControlName="password"
            data-testid="password-input"
            (input)="clearMessages()"
            [placeholder]="'form.passwordPlaceholder' | transloco"
            [disabled]="isSubmitting()"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="togglePasswordVisibility()"
            [attr.aria-label]="'form.showPassword' | transloco"
            [attr.aria-pressed]="!isPasswordHidden()"
          >
            <mat-icon>{{
              isPasswordHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-hint>{{ 'form.passwordHint' | transloco }}</mat-hint>
          @if (
            signupForm.get('password')?.invalid &&
            signupForm.get('password')?.touched
          ) {
            <mat-error>
              @if (signupForm.get('password')?.hasError('required')) {
                {{ 'form.passwordRequired' | transloco }}
              } @else if (signupForm.get('password')?.hasError('minlength')) {
                {{ 'form.passwordMinLength' | transloco }}
              }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'form.confirmPasswordLabel' | transloco }}</mat-label>
          <input
            matInput
            [type]="isConfirmPasswordHidden() ? 'password' : 'text'"
            formControlName="confirmPassword"
            data-testid="confirm-password-input"
            (input)="clearMessages()"
            [placeholder]="'form.confirmPasswordPlaceholder' | transloco"
            [disabled]="isSubmitting()"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="toggleConfirmPasswordVisibility()"
            [attr.aria-label]="'form.showPassword' | transloco"
            [attr.aria-pressed]="!isConfirmPasswordHidden()"
          >
            <mat-icon>{{
              isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (
            signupForm.get('confirmPassword')?.invalid &&
            signupForm.get('confirmPassword')?.touched
          ) {
            <mat-error>
              @if (signupForm.get('confirmPassword')?.hasError('required')) {
                {{ 'form.confirmPasswordRequired' | transloco }}
              } @else if (
                signupForm.get('confirmPassword')?.hasError('passwordsMismatch')
              ) {
                {{ 'form.passwordsMismatch' | transloco }}
              }
            </mat-error>
          }
        </mat-form-field>

        <div class="pt-2">
          <mat-checkbox
            formControlName="acceptTerms"
            [disabled]="isSubmitting()"
            data-testid="accept-terms-checkbox"
          >
            <span class="text-body-medium">
              {{ 'auth.signup.acceptTerms' | transloco }}
              <a
                [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
                target="_blank"
                class="text-primary underline"
                (click)="$event.stopPropagation()"
              >
                {{ 'auth.signup.termsOfService' | transloco }}
              </a>
              {{ 'auth.signup.acceptTermsAnd' | transloco }}
              <a
                [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
                target="_blank"
                class="text-primary underline"
                (click)="$event.stopPropagation()"
              >
                {{ 'auth.signup.privacyPolicy' | transloco }}
              </a>
            </span>
          </mat-checkbox>
          @if (
            signupForm.get('acceptTerms')?.invalid &&
            signupForm.get('acceptTerms')?.touched
          ) {
            <p class="text-error text-body-small mt-1">
              {{ 'auth.signup.acceptTermsRequired' | transloco }}
            </p>
          }
        </div>

        <pulpe-error-alert [message]="errorMessage()" />

        <pulpe-loading-button
          [loading]="isSubmitting()"
          [disabled]="!canSubmit()"
          [loadingText]="'auth.signup.submitting' | transloco"
          icon="person_add"
          testId="signup-submit-button"
          class="mt-4"
        >
          <span class="ml-2">{{ 'auth.signup.submit' | transloco }}</span>
        </pulpe-loading-button>
      </form>

      <div class="flex items-center gap-4 my-6">
        <mat-divider class="flex-1" />
        <span class="text-body-medium text-on-surface-variant">{{
          'common.or' | transloco
        }}</span>
        <mat-divider class="flex-1" />
      </div>

      <pulpe-google-oauth-button
        testId="google-signup-button"
        (authError)="errorMessage.set($event)"
        (loadingChange)="isSubmitting.set($event)"
      />

      <div class="text-center mt-6">
        <p class="text-body-medium text-on-surface-variant">
          {{ 'auth.signup.alreadyAccount' | transloco }}
          <button
            matButton
            color="primary"
            class="ml-1"
            [routerLink]="['/', ROUTES.LOGIN]"
          >
            {{ 'auth.signup.signin' | transloco }}
          </button>
        </p>
      </div>
    </div>
  `,
})
export default class Signup {
  readonly #authCredentials = inject(AuthCredentialsService);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);
  readonly #formBuilder = inject(FormBuilder);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;

  protected readonly isPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly signupForm = this.#formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: createFieldsMatchValidator(
        'password',
        'confirmPassword',
        'passwordsMismatch',
      ),
    },
  );

  readonly #formStatus = toSignal(this.signupForm.statusChanges, {
    initialValue: this.signupForm.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  protected togglePasswordVisibility(): void {
    this.isPasswordHidden.set(!this.isPasswordHidden());
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordHidden.set(!this.isConfirmPasswordHidden());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signUp(): Promise<void> {
    if (!this.signupForm.valid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage.set(this.#transloco.translate('common.formErrors'));
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.signupForm.getRawValue();

    try {
      const result = await this.#authCredentials.signUpWithEmail(
        email,
        password,
      );

      if (result.success) {
        this.#postHogService.clearPendingSignupMethod();
        this.#postHogService.enableTracking();
        this.#postHogService.captureEvent('signup_completed', {
          method: 'email',
        });
        // Guard redirects to setup-vault-code where recovery key is set up
        this.#router.navigate(['/', ROUTES.DASHBOARD]);
      } else {
        this.errorMessage.set(
          result.error || this.#transloco.translate('auth.signup.errorDefault'),
        );
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la création du compte:', error);
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
