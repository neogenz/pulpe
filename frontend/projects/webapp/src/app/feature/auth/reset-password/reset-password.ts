import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthSessionService, AuthStore, PASSWORD_MIN_LENGTH } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { createFieldsMatchValidator } from '@core/validators';
import { resetPasswordFormSchema } from './reset-password-form.schema';

@Component({
  selector: 'pulpe-reset-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    ErrorAlert,
    LoadingButton,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pulpe-entry-card w-full max-w-md"
      data-testid="reset-password-page"
    >
      @if (isCheckingSession()) {
        <div class="flex flex-col items-center gap-4 py-8">
          <mat-spinner diameter="40" />
          <p class="text-body-medium text-on-surface-variant">
            {{ 'auth.resetPassword.checkingSession' | transloco }}
          </p>
        </div>
      } @else if (!isSessionValid()) {
        <div class="text-center space-y-6" data-testid="invalid-link-message">
          <mat-icon class="text-6xl text-error">link_off</mat-icon>
          <h1 class="text-2xl font-bold text-on-surface">
            {{ 'auth.resetPassword.invalidLink' | transloco }}
          </h1>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'auth.resetPassword.invalidLinkMessage' | transloco }}
          </p>
          <a
            [routerLink]="['/', ROUTES.FORGOT_PASSWORD]"
            matButton="filled"
            color="primary"
            class="w-full"
            data-testid="back-to-forgot-password-button"
          >
            {{ 'auth.resetPassword.requestNewLink' | transloco }}
          </a>
        </div>
      } @else if (isOAuthOnly()) {
        <div class="text-center space-y-6" data-testid="oauth-user-blocked">
          <mat-icon class="text-6xl text-error">block</mat-icon>
          <h1 class="text-2xl font-bold text-on-surface">
            {{ 'auth.resetPassword.oauthTitle' | transloco }}
          </h1>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'auth.resetPassword.oauthMessage' | transloco }}
          </p>
          <a
            [routerLink]="['/', ROUTES.LOGIN]"
            matButton="filled"
            color="primary"
            class="w-full"
            data-testid="back-to-login-button"
          >
            {{ 'auth.resetPassword.backToLogin' | transloco }}
          </a>
        </div>
      } @else {
        <button
          matButton
          [routerLink]="['/', ROUTES.LOGIN]"
          class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
        >
          <mat-icon class="text-lg">arrow_back</mat-icon>
          <span>{{ 'auth.resetPassword.backToLogin' | transloco }}</span>
        </button>

        <div class="text-center mb-8 mt-4">
          <h1
            class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
          >
            {{ 'auth.resetPassword.title' | transloco }}
          </h1>
          <p class="text-body-large text-on-surface-variant">
            {{ 'auth.resetPassword.subtitle' | transloco }}
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="reset-password-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'form.newPasswordLabel' | transloco }}</mat-label>
            <input
              matInput
              [type]="isPasswordHidden() ? 'password' : 'text'"
              formControlName="newPassword"
              data-testid="new-password-input"
              (input)="clearError()"
              [placeholder]="'form.newPasswordPlaceholder' | transloco"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isPasswordHidden.set(!isPasswordHidden())"
              [attr.aria-label]="'form.showPassword' | transloco"
              [attr.aria-pressed]="!isPasswordHidden()"
            >
              <mat-icon>{{
                isPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>{{ 'form.passwordMinLengthHint' | transloco }}</mat-hint>
            @if (
              form.get('newPassword')?.invalid &&
              form.get('newPassword')?.touched
            ) {
              <mat-error>
                @if (form.get('newPassword')?.hasError('required')) {
                  {{ 'form.newPasswordRequired' | transloco }}
                } @else if (form.get('newPassword')?.hasError('minlength')) {
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
              (input)="clearError()"
              [placeholder]="'form.confirmPasswordPlaceholder' | transloco"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmPasswordHidden.set(!isConfirmPasswordHidden())"
              [attr.aria-label]="'form.showPassword' | transloco"
              [attr.aria-pressed]="!isConfirmPasswordHidden()"
            >
              <mat-icon>{{
                isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              form.get('confirmPassword')?.invalid &&
              form.get('confirmPassword')?.touched
            ) {
              <mat-error>
                @if (form.get('confirmPassword')?.hasError('required')) {
                  {{ 'form.confirmPasswordRequired' | transloco }}
                } @else if (
                  form.get('confirmPassword')?.hasError('passwordsMismatch')
                ) {
                  {{ 'form.passwordsMismatch' | transloco }}
                }
              </mat-error>
            }
          </mat-form-field>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            [loadingText]="'auth.resetPassword.submitting' | transloco"
            icon="lock_reset"
            testId="reset-password-submit-button"
          >
            <span class="ml-2">{{
              'auth.resetPassword.submit' | transloco
            }}</span>
          </pulpe-loading-button>
        </form>
      }
    </div>
  `,
})
export default class ResetPassword {
  readonly #authSession = inject(AuthSessionService);
  readonly #authStore = inject(AuthStore);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);

  protected readonly isCheckingSession = computed(() =>
    this.#authStore.isLoading(),
  );
  protected readonly isSessionValid = computed(
    () => !this.#authStore.isLoading() && this.#authStore.isAuthenticated(),
  );
  protected readonly isOAuthOnly = this.#authStore.isOAuthOnly;

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      newPassword: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: createFieldsMatchValidator(
        'newPassword',
        'confirmPassword',
        'passwordsMismatch',
      ),
    },
  );

  readonly #formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  constructor() {
    effect(() => {
      if (!this.#authStore.isLoading() && !this.#authStore.isAuthenticated()) {
        this.#logger.warn(
          'Reset password: no valid session after token exchange',
        );
      }
    });
  }

  protected clearError(): void {
    this.errorMessage.set('');
  }

  protected async onSubmit(): Promise<void> {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const parsed = resetPasswordFormSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      this.form.markAllAsTouched();
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
      return;
    }

    this.isSubmitting.set(true);
    this.clearError();

    const { newPassword } = parsed.data;

    try {
      const passwordResult =
        await this.#authSession.updatePassword(newPassword);
      if (!passwordResult.success) {
        this.errorMessage.set(
          passwordResult.error ||
            this.#transloco.translate('auth.resetPassword.errorDefault'),
        );
        return;
      }

      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Reset password failed:', error);
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
