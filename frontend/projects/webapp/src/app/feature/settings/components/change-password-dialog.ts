import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { Logger } from '@core/logging/logger';
import { MatDivider } from '@angular/material/divider';
import { ErrorAlert } from '@ui/error-alert';

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
  ],
  template: `
    <h2 mat-dialog-title class="pb-2!">Modifier le mot de passe</h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant mb-4">
        Confirme ton identité pour modifier ton accès
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="change-password-error"
      />

      <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()">
        <!-- Section: Ancien mot de passe -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Mot de passe actuel</mat-label>
          <input
            matInput
            [type]="isCurrentPasswordHidden() ? 'password' : 'text'"
            formControlName="currentPassword"
            data-testid="current-password-input"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isCurrentPasswordHidden.set(!isCurrentPasswordHidden())"
            [attr.aria-label]="'Afficher le mot de passe'"
            [attr.aria-pressed]="!isCurrentPasswordHidden()"
          >
            <mat-icon>{{
              isCurrentPasswordHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (passwordForm.get('currentPassword')?.hasError('required')) {
            <mat-error>Le mot de passe actuel est requis</mat-error>
          }
        </mat-form-field>

        <h3 class="text-title-medium pt-2!">Nouveau mot de passe</h3>
        <mat-divider class="mb-4! mt-2!"></mat-divider>

        <!-- Section: Nouveau mot de passe -->
        <div class="space-y-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nouveau mot de passe</mat-label>
            <input
              matInput
              [type]="isNewPasswordHidden() ? 'password' : 'text'"
              formControlName="newPassword"
              data-testid="new-password-input"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isNewPasswordHidden.set(!isNewPasswordHidden())"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!isNewPasswordHidden()"
            >
              <mat-icon>{{
                isNewPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>{{ PASSWORD_MIN_LENGTH }} caractères minimum</mat-hint>
            @if (passwordForm.get('newPassword')?.hasError('required')) {
              <mat-error>Le nouveau mot de passe est requis</mat-error>
            } @else if (
              passwordForm.get('newPassword')?.hasError('minlength')
            ) {
              <mat-error>
                Au moins {{ PASSWORD_MIN_LENGTH }} caractères
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Confirmer le nouveau mot de passe</mat-label>
            <input
              matInput
              [type]="isConfirmPasswordHidden() ? 'password' : 'text'"
              formControlName="confirmPassword"
              data-testid="confirm-password-input"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmPasswordHidden.set(!isConfirmPasswordHidden())"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!isConfirmPasswordHidden()"
            >
              <mat-icon>{{
                isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (passwordForm.get('confirmPassword')?.hasError('required')) {
              <mat-error>La confirmation est requise</mat-error>
            }
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="cancel-button">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        data-testid="submit-password-button"
        [disabled]="isSubmitting() || !isFormValid()"
        (click)="onSubmit()"
      >
        @if (isSubmitting()) {
          <mat-spinner diameter="20" class="mr-2" />
        }
        Confirmer
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

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCurrentPasswordHidden = signal(true);
  protected readonly isNewPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);

  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
      ],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly #formChanges = toSignal(this.passwordForm.valueChanges, {
    initialValue: this.passwordForm.value,
  });

  protected readonly isFormValid = computed(() => {
    this.#formChanges();
    if (!this.passwordForm.valid) return false;
    const { newPassword, confirmPassword } = this.passwordForm.getRawValue();
    return newPassword === confirmPassword;
  });

  protected async onSubmit(): Promise<void> {
    if (this.isSubmitting() || !this.isFormValid()) return;

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const verifyResult =
        await this.#authSession.verifyPassword(currentPassword);
      if (!verifyResult.success) {
        this.errorMessage.set(
          verifyResult.error ?? 'Mot de passe actuel incorrect',
        );
        return;
      }

      const updateResult = await this.#authSession.updatePassword(newPassword);
      if (!updateResult.success) {
        this.errorMessage.set(
          updateResult.error ?? 'Le changement de mot de passe a échoué',
        );
        return;
      }

      // Password change is purely Supabase auth - no encryption impact.
      // The vault code (and thus client key) remains unchanged.
      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error('Password change failed', error);
      this.errorMessage.set(
        'Le changement de mot de passe a échoué — réessaie plus tard',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
