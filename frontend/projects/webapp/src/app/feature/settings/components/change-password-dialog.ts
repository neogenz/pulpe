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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { Logger } from '@core/logging/logger';
import { MatDivider } from '@angular/material/divider';
import { ErrorAlert } from '@ui/error-alert';
import { createFieldsMatchValidator } from '@core/validators';
import { changePasswordFormSchema } from './change-password-dialog.schema';

@Component({
  selector: 'pulpe-change-password-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDivider,
    ErrorAlert,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title class="pb-2!">
      {{ 'settings.changePasswordTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant mb-4">
        {{ 'settings.confirmIdentity' | transloco }}
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="change-password-error"
      />

      <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()">
        <!-- Section: Ancien mot de passe -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'settings.currentPassword' | transloco }}</mat-label>
          <input
            matInput
            [type]="isCurrentPasswordHidden() ? 'password' : 'text'"
            formControlName="currentPassword"
            data-testid="current-password-input"
            (input)="clearError()"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isCurrentPasswordHidden.set(!isCurrentPasswordHidden())"
            [attr.aria-label]="showPasswordLabel"
            [attr.aria-pressed]="!isCurrentPasswordHidden()"
          >
            <mat-icon>{{
              isCurrentPasswordHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (passwordForm.get('currentPassword')?.hasError('required')) {
            <mat-error>{{
              'settings.currentPasswordRequired' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <h3 class="text-title-medium pt-2!">
          {{ 'settings.newPasswordSection' | transloco }}
        </h3>
        <mat-divider class="mb-4! mt-2!"></mat-divider>

        <!-- Section: Nouveau mot de passe -->
        <div class="space-y-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'settings.newPassword' | transloco }}</mat-label>
            <input
              matInput
              [type]="isNewPasswordHidden() ? 'password' : 'text'"
              formControlName="newPassword"
              data-testid="new-password-input"
              (input)="clearError()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isNewPasswordHidden.set(!isNewPasswordHidden())"
              [attr.aria-label]="showPasswordLabel"
              [attr.aria-pressed]="!isNewPasswordHidden()"
            >
              <mat-icon>{{
                isNewPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>{{
              'settings.passwordMinHint'
                | transloco: { min: PASSWORD_MIN_LENGTH }
            }}</mat-hint>
            @if (passwordForm.get('newPassword')?.hasError('required')) {
              <mat-error>{{
                'settings.newPasswordRequired' | transloco
              }}</mat-error>
            } @else if (
              passwordForm.get('newPassword')?.hasError('minlength')
            ) {
              <mat-error>
                {{
                  'settings.passwordMinLengthError'
                    | transloco: { min: PASSWORD_MIN_LENGTH }
                }}
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'settings.confirmNewPassword' | transloco
            }}</mat-label>
            <input
              matInput
              [type]="isConfirmPasswordHidden() ? 'password' : 'text'"
              formControlName="confirmPassword"
              data-testid="confirm-password-input"
              (input)="clearError()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmPasswordHidden.set(!isConfirmPasswordHidden())"
              [attr.aria-label]="showPasswordLabel"
              [attr.aria-pressed]="!isConfirmPasswordHidden()"
            >
              <mat-icon>{{
                isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (passwordForm.get('confirmPassword')?.hasError('required')) {
              <mat-error>{{
                'settings.confirmPasswordRequired' | transloco
              }}</mat-error>
            } @else if (
              passwordForm.get('confirmPassword')?.hasError('passwordsMismatch')
            ) {
              <mat-error>{{ 'form.passwordsMismatch' | transloco }}</mat-error>
            }
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="cancel-button">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        data-testid="submit-password-button"
        [disabled]="isSubmitting() || !isFormValid()"
        (click)="onSubmit()"
      >
        <span class="flex items-center justify-center">
          @if (isSubmitting()) {
            <mat-spinner diameter="20" class="mr-2" />
          }
          {{ 'common.confirm' | transloco }}
        </span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordDialog {
  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

  readonly #logger = inject(Logger);
  readonly #dialogRef = inject(MatDialogRef<ChangePasswordDialog>);
  readonly #authSession = inject(AuthSessionService);
  readonly #transloco = inject(TranslocoService);
  readonly #formBuilder = inject(FormBuilder);

  protected readonly showPasswordLabel = this.#transloco.translate(
    'settings.showPassword',
  );

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCurrentPasswordHidden = signal(true);
  protected readonly isNewPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);

  protected readonly passwordForm = this.#formBuilder.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
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

  readonly #formStatus = toSignal(this.passwordForm.statusChanges, {
    initialValue: this.passwordForm.status,
  });

  protected readonly isFormValid = computed(
    () => this.#formStatus() === 'VALID' && !this.isSubmitting(),
  );

  protected clearError(): void {
    this.errorMessage.set('');
  }

  protected async onSubmit(): Promise<void> {
    if (!this.isFormValid()) return;

    const parsed = changePasswordFormSchema.safeParse(
      this.passwordForm.getRawValue(),
    );
    if (!parsed.success) return;
    const { currentPassword, newPassword } = parsed.data;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const verifyResult =
        await this.#authSession.verifyPassword(currentPassword);
      if (!verifyResult.success) {
        this.errorMessage.set(
          verifyResult.error ??
            this.#transloco.translate('settings.currentPasswordIncorrect'),
        );
        return;
      }

      const updateResult = await this.#authSession.updatePassword(newPassword);
      if (!updateResult.success) {
        this.errorMessage.set(
          updateResult.error ??
            this.#transloco.translate('settings.changePasswordFailed'),
        );
        return;
      }

      // Password change is purely Supabase auth - no encryption impact.
      // The vault code (and thus client key) remains unchanged.
      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error('Password change failed', error);
      this.errorMessage.set(
        this.#transloco.translate('settings.changePasswordError'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
