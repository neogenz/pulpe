import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  type MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@core/logging/logger';
import { UserSettingsApi } from '@core/user-settings';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { EncryptionApi } from '@core/encryption';
import { DemoModeService } from '@core/demo/demo-mode.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import { PAY_DAY_MAX } from 'pulpe-shared';
import { ChangePasswordDialog } from './components/change-password-dialog';
import { RegenerateRecoveryKeyDialog } from './components/regenerate-recovery-key-dialog';

@Component({
  selector: 'pulpe-settings-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="max-w-2xl mx-auto" data-testid="settings-page">
      <h1 class="text-headline-medium mb-6">Paramètres</h1>

      <!-- ═══ Section: Compte ═══ -->
      <h2 class="text-title-large mb-4">Compte</h2>

      <mat-card appearance="outlined" class="mb-4">
        <mat-card-header>
          <div
            mat-card-avatar
            class="flex items-center justify-center bg-primary-container rounded-full"
          >
            <mat-icon class="text-on-primary-container!"
              >calendar_today</mat-icon
            >
          </div>
          <mat-card-title>Jour de paie</mat-card-title>
          <mat-card-subtitle>
            Ton budget commence le jour où tu reçois ton salaire
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content class="p-4">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>Jour de paie</mat-label>
            <mat-select
              data-testid="pay-day-select"
              [value]="selectedPayDay()"
              (selectionChange)="onPayDayChange($event)"
            >
              <mat-option [value]="null"> 1er du mois </mat-option>
              @for (day of availableDays; track day) {
                <mat-option [value]="day"> Le {{ day }} </mat-option>
              }
            </mat-select>
            <mat-hint data-testid="pay-day-hint">
              @if (selectedPayDay(); as day) {
                @if (day > 28) {
                  Ton budget commence le {{ day }}. Si le mois a moins de jours,
                  il débutera le dernier jour disponible.
                } @else {
                  Ton budget commence le {{ day }} de chaque mois
                }
              } @else {
                Ton budget suit le calendrier standard
              }
            </mat-hint>
          </mat-form-field>
        </mat-card-content>

        @if (hasChanges()) {
          <mat-card-actions class="gap-2">
            <button
              matButton
              color="warn"
              data-testid="cancel-settings-button"
              [disabled]="isSaving()"
              (click)="resetChanges()"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              color="primary"
              data-testid="save-settings-button"
              [disabled]="isSaving()"
              (click)="saveSettings()"
            >
              @if (isSaving()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              Enregistrer
            </button>
          </mat-card-actions>
        }
      </mat-card>

      <mat-card appearance="outlined" class="bg-secondary-container! mb-6">
        <mat-card-content class="flex! gap-4 p-4">
          <div class="flex items-center justify-center">
            <mat-icon class="text-on-secondary-container!">lightbulb</mat-icon>
          </div>
          <div class="flex-1">
            <p class="text-body-medium text-on-secondary-container font-medium">
              Comment ça marche ?
            </p>
            <p class="text-body-small text-on-secondary-container mt-1">
              Si tu es payé le 27, ton budget de janvier couvrira la période du
              27 décembre au 26 janvier. Tu planifies ainsi tes dépenses selon
              ton vrai rythme financier.
            </p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ═══ Section: Sécurité ═══ -->
      @if (!isDemoMode()) {
        <h2 class="text-title-large mb-4">Sécurité</h2>

        <mat-card appearance="outlined" class="mb-4">
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

          <mat-card-content class="p-4">
            <p class="text-body-medium text-on-surface mb-4">
              Tu devras saisir ton mot de passe actuel pour le modifier.
            </p>
            <button
              matButton="filled"
              color="primary"
              data-testid="change-password-button"
              (click)="onChangePassword()"
            >
              Modifier le mot de passe
            </button>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="mb-6">
          <mat-card-header>
            <div
              mat-card-avatar
              class="flex items-center justify-center bg-primary-container rounded-full"
            >
              <mat-icon class="text-on-primary-container!">vpn_key</mat-icon>
            </div>
            <mat-card-title>Clé de récupération</mat-card-title>
            <mat-card-subtitle>
              Protège l'accès à tes données chiffrées
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="p-4">
            <p class="text-body-medium text-on-surface mb-4">
              Si tu oublies ton code de coffre-fort, la clé de récupération est
              le seul moyen de retrouver l'accès à tes données chiffrées.
            </p>
            <button
              matButton="filled"
              color="primary"
              data-testid="generate-recovery-key-button"
              [disabled]="isGeneratingRecoveryKey()"
              (click)="onRegenerateRecoveryKey()"
            >
              @if (isGeneratingRecoveryKey()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              Régénérer ma clé de récupération
            </button>
          </mat-card-content>
        </mat-card>
      }

      <!-- ═══ Section: Zone de danger ═══ -->
      @if (!isDemoMode()) {
        <h2 class="text-title-large text-error mb-4">Zone de danger</h2>

        <mat-card
          appearance="outlined"
          class="bg-error-container! border-error!"
        >
          <mat-card-content class="p-4">
            <p class="text-body-medium text-on-error-container mt-1">
              La suppression de ton compte est définitive. Tu perdras l'accès à
              toutes tes données après un délai de 3 jours.
            </p>
            <button
              matButton="filled"
              color="warn"
              class="mt-4"
              data-testid="delete-account-button"
              [disabled]="isDeleting()"
              (click)="onDeleteAccount()"
            >
              @if (isDeleting()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              Supprimer mon compte
            </button>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  readonly #logger = inject(Logger);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #snackBar = inject(MatSnackBar);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #authSession = inject(AuthSessionService);
  readonly #demoMode = inject(DemoModeService);
  readonly #encryptionApi = inject(EncryptionApi);

  readonly isDemoMode = this.#demoMode.isDemoMode;
  protected readonly isSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly isGeneratingRecoveryKey = signal(false);
  readonly availableDays = Array.from({ length: PAY_DAY_MAX }, (_, i) => i + 1);

  readonly selectedPayDay = linkedSignal(
    () => this.#userSettingsApi.payDayOfMonth() ?? null,
  );

  readonly initialValue = computed(() => this.#userSettingsApi.payDayOfMonth());

  readonly hasChanges = computed(() => {
    return this.initialValue() !== this.selectedPayDay();
  });

  onPayDayChange(event: MatSelectChange): void {
    this.selectedPayDay.set(event.value);
  }

  async saveSettings(): Promise<void> {
    if (this.isSaving()) return;

    try {
      this.isSaving.set(true);

      await this.#userSettingsApi.updateSettings({
        payDayOfMonth: this.selectedPayDay(),
      });

      this.#snackBar.open("C'est enregistré", 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch (error) {
      this.#logger.error('Failed to save settings', error);
      this.#snackBar.open("L'enregistrement a échoué — on réessaie ?", 'OK', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  resetChanges(): void {
    this.selectedPayDay.set(this.initialValue());
  }

  async onChangePassword(): Promise<void> {
    const dialogRef = this.#dialog.open(ChangePasswordDialog, {
      width: '480px',
    });

    const changed = await firstValueFrom(dialogRef.afterClosed());
    if (!changed) return;

    this.#snackBar.open('Mot de passe modifié', 'OK', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    await this.#promptRecoveryKey();
  }

  async onRegenerateRecoveryKey(): Promise<void> {
    if (this.isGeneratingRecoveryKey()) return;

    const verifyRef = this.#dialog.open(RegenerateRecoveryKeyDialog, {
      width: '480px',
    });

    const verified = await firstValueFrom(verifyRef.afterClosed());
    if (!verified) return;

    await this.#generateAndShowRecoveryKey();
  }

  async onDeleteAccount(): Promise<void> {
    const dialogData: ConfirmationDialogData = {
      title: 'Supprimer ton compte ?',
      message:
        'Tu perdras immédiatement accès à ton compte. ' +
        'Toutes tes données seront supprimées définitivement après 3 jours.',
      confirmText: 'Supprimer mon compte',
      cancelText: 'Annuler',
      confirmColor: 'warn',
    };

    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: dialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      this.isDeleting.set(true);
      await this.#userSettingsApi.deleteAccount();
    } catch (error) {
      this.isDeleting.set(false);
      this.#logger.error('Failed to delete account', error);
      const message = this.#getDeleteAccountErrorMessage(error);
      this.#snackBar.open(message, 'OK', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      return;
    }

    try {
      await this.#authSession.signOut();
    } catch (error) {
      this.#logger.warn(
        'Sign out failed after account deletion scheduling',
        error,
      );
    }
    await this.#router.navigate(['/login']);
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

  async #generateAndShowRecoveryKey(): Promise<void> {
    if (this.isGeneratingRecoveryKey()) return;

    try {
      this.isGeneratingRecoveryKey.set(true);

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
        this.#snackBar.open('Nouvelle clé de récupération enregistrée', 'OK', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      }
    } catch (error) {
      this.#logger.error('Failed to generate recovery key', error);
      this.#snackBar.open(
        'La génération de la clé a échoué — réessaie plus tard',
        'OK',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        },
      );
    } finally {
      this.isGeneratingRecoveryKey.set(false);
    }
  }

  #getDeleteAccountErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Erreur réseau — vérifie ta connexion';
      }

      const errorCode = error.error?.code;
      if (errorCode === 'ERR_USER_ACCOUNT_BLOCKED') {
        return 'Ton compte est déjà programmé pour suppression';
      }
    }

    return 'La suppression a échoué — réessaie plus tard';
  }
}
