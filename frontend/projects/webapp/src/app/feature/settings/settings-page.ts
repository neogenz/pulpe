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
import { MatDividerModule } from '@angular/material/divider';
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
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import { PAY_DAY_MAX } from 'pulpe-shared';
import { ChangePasswordDialog } from './components/change-password-dialog';
import { DeleteAccountDialog } from './components/delete-account-dialog';
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
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div data-testid="settings-page">
      <h1 class="text-headline-medium mb-16">Paramètres</h1>

      <!-- ═══ Section: Compte ═══ -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8">
        <div>
          <h2 class="text-title-medium font-bold mb-2">Compte</h2>
          <p class="text-body-small text-on-surface-variant leading-relaxed">
            Gère tes préférences de compte et ton cycle budgétaire.
          </p>
        </div>

        <div class="md:col-span-2 space-y-8">
          <!-- Tip: Comment ça marche ? -->
          <div
            class="rounded-2xl bg-surface-container/50 p-5 text-on-surface-container! flex gap-4 items-start border border-outline-variant"
          >
            <mat-icon class="text-on-surface-container! shrink-0 opacity-70"
              >lightbulb</mat-icon
            >
            <div class="space-y-1">
              <p class="text-body-medium font-medium">Comment ça marche ?</p>
              <p class="text-body-small leading-relaxed">
                Si tu es payé le 27, ton budget de janvier couvrira la période
                du 27 décembre au 26 janvier. Tu planifies ainsi tes dépenses
                selon ton vrai rythme financier.
              </p>
            </div>
          </div>

          <div class="space-y-4">
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
                    Ton budget commence le {{ day }}. Si le mois a moins de
                    jours, il débutera le dernier jour disponible.
                  } @else {
                    Ton budget commence le {{ day }} de chaque mois
                  }
                } @else {
                  Ton budget suit le calendrier standard
                }
              </mat-hint>
            </mat-form-field>

            @if (hasChanges()) {
              <div class="flex justify-end gap-3 pt-2">
                <button
                  matButton
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
              </div>
            }
          </div>
        </div>
      </section>

      <mat-divider class="my-6!"></mat-divider>

      <!-- ═══ Section: Sécurité ═══ -->
      @if (!isDemoMode()) {
        <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-12">
          <div>
            <h2 class="text-title-medium font-bold mb-2">Sécurité</h2>
            <p class="text-body-small text-on-surface-variant leading-relaxed">
              Protège l'accès à tes données et gère tes clés de chiffrement.
            </p>
          </div>

          <div class="md:col-span-2 space-y-10">
            <!-- Mot de passe -->
            <div
              class="flex items-center justify-between gap-6 pb-6 border-b border-outline-variant/20"
            >
              <div class="space-y-1">
                <h3 class="text-title-small">Mot de passe</h3>
                <p class="text-body-medium text-on-surface-variant">
                  Modifier ton mot de passe de connexion.
                </p>
              </div>
              <button
                mat-stroked-button
                data-testid="change-password-button"
                (click)="onChangePassword()"
              >
                Modifier
              </button>
            </div>

            <!-- Clé de récupération -->
            <div class="flex items-center justify-between gap-6">
              <div class="space-y-1">
                <h3 class="text-title-small">Clé de récupération</h3>
                <p class="text-body-medium text-on-surface-variant">
                  Indispensable si tu oublies ton code de coffre-fort.
                </p>
              </div>
              <button
                mat-stroked-button
                data-testid="generate-recovery-key-button"
                [disabled]="isGeneratingRecoveryKey()"
                (click)="onRegenerateRecoveryKey()"
              >
                @if (isGeneratingRecoveryKey()) {
                  <mat-spinner diameter="20" class="mr-2" />
                }
                Régénérer
              </button>
            </div>
          </div>
        </section>

        <mat-divider class="my-6!"></mat-divider>
      }

      <!-- ═══ Section: Zone de danger ═══ -->
      @if (!isDemoMode()) {
        <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 pb-12">
          <div>
            <h2 class="text-title-medium text-error font-bold mb-2">
              Zone de danger
            </h2>
            <p class="text-body-small text-error opacity-70 leading-relaxed">
              Actions irréversibles sur ton compte.
            </p>
          </div>

          <div class="md:col-span-2">
            <div
              class="bg-error-container/30 rounded-2xl border border-error/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
            >
              <div class="space-y-1">
                <h3 class="text-title-small font-bold text-error">
                  Supprimer mon compte
                </h3>
                <p class="text-body-medium text-error opacity-90">
                  Tes données seront supprimées définitivement après 3 jours.
                </p>
              </div>
              <button
                matButton="filled"
                color="warn"
                data-testid="delete-account-button"
                [disabled]="isDeleting()"
                (click)="onDeleteAccount()"
                class="shrink-0"
              >
                @if (isDeleting()) {
                  <mat-spinner diameter="20" class="mr-2" />
                }
                Supprimer le compte
              </button>
            </div>
          </div>
        </section>
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
    const dialogRef = this.#dialog.open(DeleteAccountDialog, {
      width: '440px',
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
