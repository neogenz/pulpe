import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ANALYTICS_EVENTS } from 'pulpe-shared';

import {
  AuthCredentialsService,
  PASSWORD_MIN_LENGTH,
  type OAuthProvider,
} from '@core/auth';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { OAuthProviderButton } from '@app/pattern/oauth-provider';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { OnboardingProgress } from '@ui/onboarding-progress';
import { PasswordCriteria } from '@ui/password-criteria';
import { createFieldsMatchValidator } from '@core/validators';
import {
  PASSWORD_HAS_LETTER,
  PASSWORD_HAS_NUMBER,
  signupFormSchema,
} from './signup-form.schema';

function containsPattern(pattern: RegExp, errorKey: string) {
  return (control: AbstractControl): ValidationErrors | null =>
    pattern.test(control.value ?? '') ? null : { [errorKey]: true };
}

@Component({
  selector: 'pulpe-signup',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    RouterLink,
    OAuthProviderButton,
    ErrorAlert,
    LoadingButton,
    OnboardingProgress,
    PasswordCriteria,
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

      <pulpe-onboarding-progress class="mt-4 mb-7" [currentStep]="1" />

      <div class="text-center mb-8">
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
        >
          {{ 'auth.signup.title' | transloco }}
        </h1>
        <p class="text-body-large text-on-surface-variant">
          {{ 'auth.signup.subtitle' | transloco }}
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <pulpe-oauth-provider-button
          [provider]="'apple'"
          testId="apple-signup-button"
          [disabled]="isBusy()"
          (authError)="onOAuthError($event)"
          (loadingChange)="onOAuthLoadingChange('apple', $event)"
        />
        <pulpe-oauth-provider-button
          [provider]="'google'"
          testId="google-signup-button"
          [disabled]="isBusy()"
          (authError)="onOAuthError($event)"
          (loadingChange)="onOAuthLoadingChange('google', $event)"
        />
      </div>

      <div class="flex items-center gap-4 my-6">
        <mat-divider class="flex-1" />
        <span class="text-body-medium text-on-surface-variant">{{
          'common.or' | transloco
        }}</span>
        <mat-divider class="flex-1" />
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
            #emailInput
            matInput
            type="email"
            autocomplete="email"
            formControlName="email"
            data-testid="email-input"
            (input)="clearMessages()"
            [placeholder]="'form.emailPlaceholder' | transloco"
            [disabled]="isBusy()"
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
            autocomplete="new-password"
            formControlName="password"
            data-testid="password-input"
            (input)="clearMessages()"
            [placeholder]="'form.passwordPlaceholder' | transloco"
            [disabled]="isBusy()"
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
          <!-- Seule l'erreur required a un message ici : minlength/hasNumber/
               hasLetter sont portées par la checklist pulpe-password-criteria
               ci-dessous. Le gate sur required évite un mat-error vide (région
               live annoncée sans contenu) pour ces erreurs-là. -->
          @if (
            signupForm.get('password')?.hasError('required') &&
            signupForm.get('password')?.touched
          ) {
            <mat-error>
              {{ 'form.passwordRequired' | transloco }}
            </mat-error>
          }
        </mat-form-field>

        <pulpe-password-criteria
          [password]="passwordValue()"
          [minLength]="PASSWORD_MIN_LENGTH"
        />

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'form.confirmPasswordLabel' | transloco }}</mat-label>
          <input
            matInput
            [type]="isConfirmPasswordHidden() ? 'password' : 'text'"
            autocomplete="new-password"
            formControlName="confirmPassword"
            data-testid="confirm-password-input"
            (input)="clearMessages()"
            [placeholder]="'form.confirmPasswordPlaceholder' | transloco"
            [disabled]="isBusy()"
          />
          <mat-icon matPrefix>lock_reset</mat-icon>
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

        <pulpe-error-alert [message]="errorMessage()" />

        <pulpe-loading-button
          [loading]="isSubmitting()"
          [disabled]="isBusy()"
          [loadingText]="'auth.signup.submitting' | transloco"
          icon="person_add"
          testId="signup-submit-button"
          class="mt-4"
        >
          <span class="ml-2">{{ 'auth.signup.submit' | transloco }}</span>
        </pulpe-loading-button>

        <!-- Consentement implicite (sign-in wrap) — parité iOS. Deux verbes
             distincts volontairement : on ACCEPTE les CGU (contrat), on PREND
             CONNAISSANCE de la politique de confidentialité (information art. 13).
             Les fusionner sous un seul « tu acceptes » est la forme d'acceptation
             groupée que visent l'art. 7(2) RGPD et les LD 2/2019 §20 du CEPD.
             Voir docs/CONSENT.md. -->
        <p
          class="text-body-small text-on-surface-variant text-center mt-3"
          data-testid="implicit-consent"
        >
          {{ 'auth.signup.implicitConsent' | transloco }}
          <a
            [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline underline-offset-2"
          >
            {{ 'auth.signup.termsOfService' | transloco }}
          </a>
          {{ 'auth.signup.privacyAcknowledgement' | transloco }}
          <a
            [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline underline-offset-2"
          >
            {{ 'auth.signup.privacyPolicy' | transloco }}</a
          >.
        </p>
      </form>

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
  protected readonly isOAuthLoading = signal(false);
  protected readonly errorMessage = signal('');
  // Disables inputs + submit when EITHER email submit or an OAuth redirect is
  // in flight — prevents double-submit without freezing the form just because
  // a provider redirect is briefly loading.
  protected readonly isBusy = computed(
    () => this.isSubmitting() || this.isOAuthLoading(),
  );

  private readonly emailInput =
    viewChild<ElementRef<HTMLInputElement>>('emailInput');

  constructor() {
    afterNextRender(() => {
      this.emailInput()?.nativeElement.focus();
    });
  }

  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

  protected readonly signupForm = this.#formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          containsPattern(PASSWORD_HAS_NUMBER, 'hasNumber'),
          containsPattern(PASSWORD_HAS_LETTER, 'hasLetter'),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: createFieldsMatchValidator(
        'password',
        'confirmPassword',
        'passwordsMismatch',
      ),
    },
  );

  protected readonly passwordValue = toSignal(
    this.signupForm.controls.password.valueChanges,
    { initialValue: '' },
  );

  // Same contract as the welcome page: stores the pending method so
  // `capturePendingSignupCompleted` can emit signup_completed after the
  // OAuth redirect — without it, an OAuth signup from /signup is invisible
  // to the funnel.
  protected onOAuthLoadingChange(
    method: OAuthProvider,
    isLoading: boolean,
  ): void {
    this.isOAuthLoading.set(isLoading);
    if (isLoading) {
      this.#postHogService.setPendingSignupMethod(method);
      this.#postHogService.captureEvent(ANALYTICS_EVENTS.SIGNUP_STARTED, {
        method,
      });
    }
    // Pas de clear sur `false` : le succès OAuth émet loadingChange(false)
    // avant que le redirect n'emporte la page — effacer ici tue le
    // signup_completed lu au retour. La clé est consommée à la lecture
    // (capturePendingSignupCompleted) ; l'échec avéré passe par onOAuthError.
  }

  protected onOAuthError(message: string): void {
    this.errorMessage.set(message);
    this.#postHogService.clearPendingSignupMethod();
  }

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

    const parsed = signupFormSchema.safeParse(this.signupForm.getRawValue());
    if (!parsed.success) {
      this.signupForm.markAllAsTouched();
      this.errorMessage.set(this.#transloco.translate('form.emailInvalid'));
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = parsed.data;

    try {
      const result = await this.#authCredentials.signUpWithEmail(
        email,
        password,
      );

      if (result.success) {
        this.#postHogService.clearPendingSignupMethod();
        this.#postHogService.enableTracking();
        this.#postHogService.captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
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
