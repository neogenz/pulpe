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
import { firstValueFrom } from 'rxjs';

import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { Logger } from '@core/logging/logger';

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
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      Modifier le mot de passe
    </h2>

    <mat-dialog-content class="pt-2!">
      @if (errorMessage(); as error) {
        <p
          class="text-body-medium text-error mb-4"
          data-testid="change-password-error"
        >
          {{ error }}
        </p>
      }

      <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Mot de passe actuel</mat-label>
          <input
            matInput
            type="password"
            formControlName="currentPassword"
            data-testid="current-password-input"
          />
          @if (passwordForm.get('currentPassword')?.hasError('required')) {
            <mat-error>Le mot de passe actuel est requis</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Nouveau mot de passe</mat-label>
          <input
            matInput
            type="password"
            formControlName="newPassword"
            data-testid="new-password-input"
          />
          @if (passwordForm.get('newPassword')?.hasError('required')) {
            <mat-error>Le nouveau mot de passe est requis</mat-error>
          } @else if (passwordForm.get('newPassword')?.hasError('minlength')) {
            <mat-error>
              Au moins {{ PASSWORD_MIN_LENGTH }} caractères
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Confirmer le nouveau mot de passe</mat-label>
          <input
            matInput
            type="password"
            formControlName="confirmPassword"
            data-testid="confirm-password-input"
          />
          @if (passwordForm.get('confirmPassword')?.hasError('required')) {
            <mat-error>La confirmation est requise</mat-error>
          }
        </mat-form-field>
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
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #clientKeyService = inject(ClientKeyService);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

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

  readonly #formChanges = toSignal(this.passwordForm.valueChanges);

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

      await this.#rekeyEncryption(newPassword);
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

  async #rekeyEncryption(newPassword: string): Promise<void> {
    const { salt, kdfIterations } = await firstValueFrom(
      this.#encryptionApi.getSalt$(),
    );
    const newClientKeyHex = await deriveClientKey(
      newPassword,
      salt,
      kdfIterations,
    );

    await firstValueFrom(
      this.#encryptionApi.notifyPasswordChange$(newClientKeyHex),
    );

    this.#clientKeyService.setDirectKey(newClientKeyHex);
  }
}
