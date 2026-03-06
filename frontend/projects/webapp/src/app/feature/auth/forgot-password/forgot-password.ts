import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthSessionService } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-forgot-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    ErrorAlert,
    LoadingButton,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pulpe-entry-card w-full max-w-md"
      data-testid="forgot-password-page"
    >
      <button
        matButton
        [routerLink]="['/', ROUTES.LOGIN]"
        class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
      >
        <mat-icon class="text-lg">arrow_back</mat-icon>
        <span>{{ 'auth.forgotPassword.backToLogin' | transloco }}</span>
      </button>

      <div class="text-center mb-8 mt-4">
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
        >
          {{ 'auth.forgotPassword.title' | transloco }}
        </h1>
        @if (!isSuccess()) {
          <p class="text-body-large text-on-surface-variant">
            {{ 'auth.forgotPassword.subtitle' | transloco }}
          </p>
        }
      </div>

      @if (!isSuccess()) {
        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-6"
          data-testid="forgot-password-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'form.emailLabel' | transloco }}</mat-label>
            <input
              matInput
              type="email"
              formControlName="email"
              data-testid="email-input"
              (input)="clearError()"
              [placeholder]="'form.emailPlaceholder' | transloco"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>email</mat-icon>
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <mat-error>
                @if (form.get('email')?.hasError('required')) {
                  {{ 'form.emailRequired' | transloco }}
                } @else if (form.get('email')?.hasError('email')) {
                  {{ 'form.emailInvalid' | transloco }}
                }
              </mat-error>
            }
          </mat-form-field>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            [loadingText]="'auth.forgotPassword.submitting' | transloco"
            icon="send"
            testId="forgot-password-submit-button"
          >
            <span class="ml-2">{{
              'auth.forgotPassword.submit' | transloco
            }}</span>
          </pulpe-loading-button>
        </form>
      } @else {
        <div
          class="text-center space-y-6"
          data-testid="forgot-password-success"
        >
          <mat-icon class="text-6xl text-primary">mark_email_read</mat-icon>
          <p class="text-body-large text-on-surface">
            {{ 'auth.forgotPassword.successMessage' | transloco }}
          </p>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'auth.forgotPassword.checkSpam' | transloco }}
          </p>
          <button
            [routerLink]="['/', ROUTES.LOGIN]"
            matButton
            color="primary"
            class="w-full"
            data-testid="back-to-login-button"
          >
            {{ 'auth.forgotPassword.backToLogin' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
})
export default class ForgotPassword {
  readonly #authSession = inject(AuthSessionService);
  readonly #formBuilder = inject(FormBuilder);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isSuccess = signal(false);

  protected readonly form = this.#formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly #formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  protected clearError(): void {
    this.errorMessage.set('');
  }

  protected async onSubmit(): Promise<void> {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.clearError();

    const { email } = this.form.getRawValue();

    try {
      const result = await this.#authSession.resetPasswordForEmail(email);

      if (result.success) {
        this.isSuccess.set(true);
      } else {
        this.errorMessage.set(
          result.error ||
            this.#transloco.translate('auth.forgotPassword.errorDefault'),
        );
      }
    } catch (error) {
      this.#logger.error('Error sending reset email:', error);
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
