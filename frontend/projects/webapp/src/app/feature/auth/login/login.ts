import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  LOCALE_ID,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AuthCredentialsService,
  formatDeletionDate,
  PASSWORD_MIN_LENGTH,
  SCHEDULED_DELETION_PARAMS,
} from '@core/auth';
import { GoogleOAuthButton } from '@app/pattern/google-oauth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-login',

  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
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
        <span>{{ 'auth.login.backToHome' | transloco }}</span>
      </button>

      <div class="text-center mb-8 mt-4">
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
        >
          {{ 'auth.login.title' | transloco }}
        </h1>
        <p class="text-body-large text-on-surface-variant">
          {{ 'auth.login.subtitle' | transloco }}
        </p>
      </div>

      <form
        [formGroup]="loginForm"
        (ngSubmit)="signIn()"
        class="space-y-6"
        data-testid="login-form"
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
            loginForm.get('email')?.invalid && loginForm.get('email')?.touched
          ) {
            <mat-error>
              @if (loginForm.get('email')?.hasError('required')) {
                {{ 'form.emailRequired' | transloco }}
              } @else if (loginForm.get('email')?.hasError('email')) {
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
          @if (
            loginForm.get('password')?.invalid &&
            loginForm.get('password')?.touched
          ) {
            <mat-error>
              @if (loginForm.get('password')?.hasError('required')) {
                {{ 'form.passwordRequired' | transloco }}
              } @else if (loginForm.get('password')?.hasError('minlength')) {
                {{ 'form.passwordMinLength' | transloco }}
              }
            </mat-error>
          }
        </mat-form-field>

        <div class="flex justify-end -mt-2">
          <a
            [routerLink]="['/', ROUTES.FORGOT_PASSWORD]"
            class="text-body-small text-primary hover:underline"
            data-testid="forgot-password-link"
          >
            {{ 'auth.login.forgotPassword' | transloco }}
          </a>
        </div>

        <pulpe-error-alert [message]="errorMessage()" />

        <pulpe-loading-button
          [loading]="isSubmitting()"
          [disabled]="!canSubmit()"
          [loadingText]="'auth.login.submitting' | transloco"
          icon="login"
          testId="login-submit-button"
        >
          <span class="ml-2">{{ 'auth.login.submit' | transloco }}</span>
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
        testId="google-login-button"
        (authError)="errorMessage.set($event)"
        (loadingChange)="isSubmitting.set($event)"
      />

      <div class="text-center mt-6">
        <p class="text-body-medium text-on-surface-variant">
          {{ 'auth.login.noAccount' | transloco }}
          <button
            matButton
            color="primary"
            class="ml-1"
            [routerLink]="['/', ROUTES.SIGNUP]"
          >
            {{ 'auth.login.createAccount' | transloco }}
          </button>
        </p>
      </div>
    </div>
  `,
})
export default class Login {
  readonly #authCredentials = inject(AuthCredentialsService);
  readonly #formBuilder = inject(FormBuilder);
  readonly #locale = inject(LOCALE_ID);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly isPasswordHidden = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  constructor() {
    const reason = this.#route.snapshot.queryParamMap.get(
      SCHEDULED_DELETION_PARAMS.REASON,
    );
    const date = this.#route.snapshot.queryParamMap.get(
      SCHEDULED_DELETION_PARAMS.DATE,
    );
    if (reason === SCHEDULED_DELETION_PARAMS.REASON_VALUE && date) {
      this.errorMessage.set(
        this.#transloco.translate('auth.scheduledDeletion', {
          date: formatDeletionDate(date, this.#locale),
        }),
      );
    }
  }

  protected readonly loginForm = this.#formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
    ],
  });

  readonly #formStatus = toSignal(this.loginForm.statusChanges, {
    initialValue: this.loginForm.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  protected togglePasswordVisibility(): void {
    this.isPasswordHidden.set(!this.isPasswordHidden());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signIn(): Promise<void> {
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set(this.#transloco.translate('common.formErrors'));
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.loginForm.getRawValue();

    try {
      const result = await this.#authCredentials.signInWithEmail(
        email,
        password,
      );

      if (result.success) {
        this.#router.navigate(['/', ROUTES.DASHBOARD]);
      } else {
        this.errorMessage.set(
          result.error || this.#transloco.translate('auth.login.errorDefault'),
        );
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la connexion:', error);
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
