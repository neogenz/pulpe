import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { Logger } from '@core/logging/logger';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';

@Component({
  selector: 'pulpe-change-password-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card appearance="outlined" class="mb-6">
      <mat-card-header>
        <div
          mat-card-avatar
          class="flex items-center justify-center bg-primary-container rounded-full"
        >
          <mat-icon class="text-on-primary-container!">lock</mat-icon>
        </div>
        <mat-card-title>Mot de passe</mat-card-title>
        <mat-card-subtitle>
          Modifier ton mot de passe de connexion
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        @if (errorMessage(); as error) {
          <p
            class="text-body-medium text-error mb-4"
            data-testid="change-password-error"
          >
            {{ error }}
          </p>
        }

        <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()">
          <mat-form-field appearance="outline" class="w-full mb-2">
            <mat-label>Nouveau mot de passe</mat-label>
            <input
              matInput
              type="password"
              formControlName="newPassword"
              data-testid="new-password-input"
            />
            @if (passwordForm.get('newPassword')?.hasError('required')) {
              <mat-error>Le mot de passe est requis</mat-error>
            } @else if (
              passwordForm.get('newPassword')?.hasError('minlength')
            ) {
              <mat-error>
                Au moins {{ PASSWORD_MIN_LENGTH }} caractères
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full mb-4">
            <mat-label>Confirmer le mot de passe</mat-label>
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

          <button
            matButton="filled"
            color="primary"
            type="submit"
            data-testid="change-password-button"
            [disabled]="isChanging() || !isFormValid()"
          >
            @if (isChanging()) {
              <mat-spinner diameter="20" class="mr-2" />
            }
            Modifier le mot de passe
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordCard {
  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

  readonly #logger = inject(Logger);
  readonly #authSession = inject(AuthSessionService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);

  readonly isChanging = signal(false);
  readonly errorMessage = signal('');

  readonly passwordForm = new FormGroup({
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

  protected isFormValid(): boolean {
    if (!this.passwordForm.valid) return false;
    const { newPassword, confirmPassword } = this.passwordForm.getRawValue();
    return newPassword === confirmPassword;
  }

  protected async onChangePassword(): Promise<void> {
    if (this.isChanging() || !this.isFormValid()) return;

    const { newPassword } = this.passwordForm.getRawValue();

    this.isChanging.set(true);
    this.errorMessage.set('');

    try {
      const result = await this.#authSession.updatePassword(newPassword);
      if (!result.success) {
        this.errorMessage.set(
          result.error ?? 'Le changement de mot de passe a échoué',
        );
        return;
      }

      await this.#rekeyEncryption(newPassword);
      this.passwordForm.reset();

      this.#snackBar.open('Mot de passe modifié', 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });

      await this.#promptRecoveryKey();
    } catch (error) {
      this.#logger.error('Password change failed', error);
      this.errorMessage.set(
        'Le changement de mot de passe a échoué — réessaie plus tard',
      );
    } finally {
      this.isChanging.set(false);
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

  async #promptRecoveryKey(): Promise<void> {
    try {
      const { recoveryKey } = await firstValueFrom(
        this.#encryptionApi.setupRecoveryKey$(),
      );

      const dialogData: RecoveryKeyDialogData = { recoveryKey };
      const dialogRef = this.#dialog.open(RecoveryKeyDialog, {
        data: dialogData,
        width: '480px',
        disableClose: true,
      });

      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (confirmed) {
        this.#snackBar.open('Clé de récupération enregistrée', 'OK', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      }
    } catch (error) {
      this.#logger.warn(
        'Recovery key setup failed after password change — user can generate later from settings',
        error,
      );
    }
  }
}
