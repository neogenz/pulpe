import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  type MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { isApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { FeatureFlagsService } from '@core/feature-flags';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStore } from '@core/auth';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { ROUTES } from '@core/routing/routes-constants';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import { CurrencyConverterWidget } from '@pattern/currency-converter-widget';
import { PAY_DAY_MAX, type SupportedCurrency } from 'pulpe-shared';
import { ChangePasswordDialog } from './components/change-password-dialog';
import { ChangePinDialog } from './components/change-pin-dialog';
import { DeleteAccountDialog } from './components/delete-account-dialog';
import { RegenerateRecoveryKeyDialog } from './components/regenerate-recovery-key-dialog';
import { VerifyRecoveryKeyDialog } from './components/verify-recovery-key-dialog';

@Component({
  selector: 'pulpe-settings-page',
  imports: [
    CurrencyConverterWidget,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    TranslocoPipe,
  ],
  template: `
    <div data-testid="settings-page">
      <h1 class="text-headline-medium mb-8">
        {{ 'settings.title' | transloco }}
      </h1>

      <!-- ═══ Section: Compte ═══ -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8">
        <div>
          <h2 class="text-title-medium font-bold mb-2">
            {{ 'settings.accountSection' | transloco }}
          </h2>
          <p class="text-body-small text-on-surface-variant leading-relaxed">
            {{ 'settings.accountDescription' | transloco }}
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
              <p class="text-body-medium font-medium">
                {{ 'settings.howItWorks' | transloco }}
              </p>
              <p class="text-body-small leading-relaxed">
                {{ 'settings.howItWorksDetail' | transloco }}
              </p>
            </div>
          </div>

          <div class="space-y-4">
            @if (isMultiCurrencyEnabled()) {
              <!-- Currency Selector -->
              <div class="flex flex-col gap-2">
                <p class="text-label-medium text-on-surface-variant">
                  {{ 'settings.currencyLabel' | transloco }}
                </p>
                <mat-button-toggle-group
                  [attr.aria-label]="'settings.currencyLabel' | transloco"
                  [value]="selectedCurrency()"
                  (change)="onCurrencyChange($event.value)"
                  data-testid="currency-toggle"
                  class="w-full"
                  hideSingleSelectionIndicator
                >
                  <mat-button-toggle value="CHF" class="flex-1">
                    <span class="flex flex-col items-center leading-tight py-1">
                      <span class="text-base"
                        ><span class="text-lg mr-1">🇨🇭</span>CHF</span
                      >
                      <span class="text-xs text-on-surface-variant">{{
                        'currency.swissFranc' | transloco
                      }}</span>
                    </span>
                  </mat-button-toggle>
                  <mat-button-toggle value="EUR" class="flex-1">
                    <span class="flex flex-col items-center leading-tight py-1">
                      <span class="text-base"
                        ><span class="text-lg mr-1">🇪🇺</span>EUR</span
                      >
                      <span class="text-xs text-on-surface-variant">{{
                        'currency.euro' | transloco
                      }}</span>
                    </span>
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <!-- Currency Selector Toggle -->
              <div class="flex items-center justify-between gap-4 py-2">
                <div class="space-y-0.5">
                  <p class="text-body-medium">
                    {{ 'settings.currencySelectorLabel' | transloco }}
                  </p>
                  <p class="text-body-small text-on-surface-variant">
                    {{ 'settings.currencySelectorDescription' | transloco }}
                  </p>
                </div>
                <mat-slide-toggle
                  [checked]="selectedShowCurrencySelector()"
                  (change)="onShowCurrencySelectorChange($event.checked)"
                  data-testid="show-currency-selector-toggle"
                />
              </div>

              @if (isConverterVisible()) {
                <pulpe-currency-converter-widget
                  [savedCurrency]="initialCurrency()"
                  [draftCurrency]="selectedCurrency()"
                />
              }
            }

            <mat-form-field
              appearance="outline"
              subscriptSizing="dynamic"
              class="w-full"
            >
              <mat-label>{{ 'settings.payDay' | transloco }}</mat-label>
              <mat-select
                data-testid="pay-day-select"
                [value]="selectedPayDay()"
                (selectionChange)="onPayDayChange($event)"
              >
                <mat-option [value]="null">
                  {{ 'settings.firstOfMonth' | transloco }}
                </mat-option>
                @for (day of availableDays; track day) {
                  <mat-option [value]="day">
                    {{ 'settings.the' | transloco }} {{ day }}
                  </mat-option>
                }
              </mat-select>
              <mat-hint data-testid="pay-day-hint">
                @if (selectedPayDay(); as day) {
                  @if (day > 28) {
                    {{ 'settings.payDayHintCustom' | transloco: { day: day } }}
                  } @else {
                    {{
                      'settings.payDayHintStandard' | transloco: { day: day }
                    }}
                  }
                } @else {
                  {{ 'settings.payDayHintDefault' | transloco }}
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
                  {{ 'common.cancel' | transloco }}
                </button>
                <button
                  matButton="filled"
                  color="primary"
                  data-testid="save-settings-button"
                  [disabled]="isSaving()"
                  (click)="saveSettings()"
                >
                  <span class="flex items-center justify-center">
                    @if (isSaving()) {
                      <mat-spinner diameter="20" class="mr-2" />
                    }
                    {{ 'common.save' | transloco }}
                  </span>
                </button>
              </div>
            }
          </div>
        </div>
      </section>

      <mat-divider class="my-8!"></mat-divider>

      <!-- ═══ Section: Sécurité ═══ -->
      @if (!isDemoMode()) {
        <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-12">
          <div>
            <h2 class="text-title-medium font-bold mb-2">
              {{ 'settings.securitySection' | transloco }}
            </h2>
            <p class="text-body-small text-on-surface-variant leading-relaxed">
              {{ 'settings.securityDescription' | transloco }}
            </p>
          </div>

          <div class="md:col-span-2 space-y-10">
            @if (!isOAuthOnly()) {
              <!-- Mot de passe -->
              <div
                class="flex items-center justify-between gap-6 pb-6 border-b border-outline-variant/20"
              >
                <div class="space-y-1">
                  <h3 class="text-title-small">
                    {{ 'settings.password' | transloco }}
                  </h3>
                  <p class="text-body-medium text-on-surface-variant">
                    {{ 'settings.passwordDescription' | transloco }}
                  </p>
                </div>
                <button
                  matButton="outlined"
                  data-testid="change-password-button"
                  (click)="onChangePassword()"
                >
                  {{ 'settings.changePassword' | transloco }}
                </button>
              </div>
            }

            <!-- Code PIN -->
            <div
              class="flex items-center justify-between gap-6 pb-6 border-b border-outline-variant/20"
            >
              <div class="space-y-1">
                <h3 class="text-title-small">
                  {{ 'settings.pinCode' | transloco }}
                </h3>
                <p class="text-body-medium text-on-surface-variant">
                  {{ 'settings.pinCodeDescription' | transloco }}
                </p>
              </div>
              <button
                matButton="outlined"
                data-testid="change-pin-button"
                (click)="onChangePin()"
              >
                {{ 'common.edit' | transloco }}
              </button>
            </div>

            <!-- Clé de récupération -->
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
            >
              <div class="space-y-1 min-w-0">
                <h3 class="text-title-small">
                  {{ 'settings.recoveryKey' | transloco }}
                </h3>
                <p class="text-body-medium text-on-surface-variant">
                  {{ 'settings.recoveryKeyDescription' | transloco }}
                </p>
              </div>
              <div class="flex flex-wrap gap-3 items-center shrink-0">
                <button
                  matButton="outlined"
                  data-testid="generate-recovery-key-button"
                  [disabled]="isGeneratingRecoveryKey()"
                  (click)="onRegenerateRecoveryKey()"
                >
                  <span class="flex items-center justify-center">
                    @if (isGeneratingRecoveryKey()) {
                      <mat-spinner diameter="20" class="mr-2" />
                    }
                    {{ 'settings.regenerateKey' | transloco }}
                  </span>
                </button>
                <button
                  matButton="outlined"
                  data-testid="verify-recovery-key-button"
                  (click)="onVerifyRecoveryKey()"
                >
                  {{ 'settings.verifyRecoveryKeyAction' | transloco }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <mat-divider class="my-8!"></mat-divider>
      }

      <!-- ═══ Section: Zone de danger ═══ -->
      @if (!isDemoMode()) {
        <section class="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 pb-12">
          <div>
            <h2 class="text-title-medium text-error font-bold mb-2">
              {{ 'settings.dangerSection' | transloco }}
            </h2>
            <p class="text-body-small text-error opacity-70 leading-relaxed">
              {{ 'settings.dangerDescription' | transloco }}
            </p>
          </div>

          <div class="md:col-span-2">
            <div
              class="bg-error-container/30 rounded-2xl border border-error/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
            >
              <div class="space-y-1">
                <h3 class="text-title-small font-bold text-error">
                  {{ 'settings.deleteAccount' | transloco }}
                </h3>
                <p class="text-body-medium text-error opacity-90">
                  {{ 'settings.deleteAccountDescription' | transloco }}
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
                <span class="flex items-center justify-center">
                  @if (isDeleting()) {
                    <mat-spinner diameter="20" class="mr-2" />
                  }
                  {{ 'settings.deleteAccountButton' | transloco }}
                </span>
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
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #snackBar = inject(MatSnackBar);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #authSession = inject(AuthSessionService);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #authStore = inject(AuthStore);
  readonly #transloco = inject(TranslocoService);
  readonly #featureFlags = inject(FeatureFlagsService);

  readonly isDemoMode = this.#demoMode.isDemoMode;
  protected readonly isMultiCurrencyEnabled =
    this.#featureFlags.isMultiCurrencyEnabled;
  protected readonly isOAuthOnly = this.#authStore.isOAuthOnly;
  protected readonly isSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly isGeneratingRecoveryKey = signal(false);
  readonly availableDays = Array.from({ length: PAY_DAY_MAX }, (_, i) => i + 1);

  // Pay day settings
  readonly selectedPayDay = linkedSignal(
    () => this.#userSettingsStore.payDayOfMonth() ?? null,
  );

  // Currency settings
  readonly selectedCurrency = linkedSignal(() =>
    this.#userSettingsStore.currency(),
  );

  // Show currency selector toggle
  readonly selectedShowCurrencySelector = linkedSignal(() =>
    this.#userSettingsStore.showCurrencySelector(),
  );

  readonly initialPayDay = computed(() =>
    this.#userSettingsStore.payDayOfMonth(),
  );
  readonly initialCurrency = computed(() => this.#userSettingsStore.currency());
  readonly initialShowCurrencySelector = computed(() =>
    this.#userSettingsStore.showCurrencySelector(),
  );

  readonly hasChanges = computed(() => {
    return (
      this.initialPayDay() !== this.selectedPayDay() ||
      this.initialCurrency() !== this.selectedCurrency() ||
      this.initialShowCurrencySelector() !== this.selectedShowCurrencySelector()
    );
  });

  protected readonly isConverterVisible = computed(
    () => this.selectedCurrency() !== this.initialCurrency(),
  );

  onPayDayChange(event: MatSelectChange): void {
    this.selectedPayDay.set(event.value);
  }

  onShowCurrencySelectorChange(value: boolean): void {
    this.selectedShowCurrencySelector.set(value);
  }

  onCurrencyChange(value: SupportedCurrency): void {
    this.selectedCurrency.set(value);
  }

  async saveSettings(): Promise<void> {
    if (this.isSaving()) return;

    try {
      this.isSaving.set(true);

      await this.#userSettingsStore.updateSettings({
        payDayOfMonth: this.selectedPayDay(),
        currency: this.selectedCurrency(),
        showCurrencySelector: this.selectedShowCurrencySelector(),
      });

      this.#snackBar.open(
        this.#transloco.translate('settings.saveSuccess'),
        'OK',
        {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        },
      );
    } catch (error) {
      this.#logger.error('Failed to save settings', error);
      this.#snackBar.open(
        this.#transloco.translate('settings.saveError'),
        'OK',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        },
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  resetChanges(): void {
    this.selectedPayDay.set(this.initialPayDay());
    this.selectedCurrency.set(this.initialCurrency());
    this.selectedShowCurrencySelector.set(this.initialShowCurrencySelector());
  }

  async onChangePassword(): Promise<void> {
    const dialogRef = this.#dialog.open(ChangePasswordDialog, {
      width: '480px',
    });

    const changed = await firstValueFrom(dialogRef.afterClosed());
    if (!changed) return;

    this.#snackBar.open(
      this.#transloco.translate('settings.passwordChanged'),
      'OK',
      {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      },
    );
  }

  async onChangePin(): Promise<void> {
    const dialogRef = this.#dialog.open(ChangePinDialog, { width: '480px' });
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) return;

    if (result.recoveryKey) {
      const dialogData: RecoveryKeyDialogData = {
        recoveryKey: result.recoveryKey,
      };
      const recoveryRef = this.#dialog.open(RecoveryKeyDialog, {
        data: dialogData,
        width: '480px',
        disableClose: true,
      });
      await firstValueFrom(recoveryRef.afterClosed());
    }

    this.#snackBar.open(
      this.#transloco.translate(
        result.recoveryKey
          ? 'settings.pinChanged'
          : 'settings.pinChangedNoRecovery',
      ),
      'OK',
      {
        duration: result.recoveryKey ? 3000 : 6000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      },
    );
  }

  onVerifyRecoveryKey(): void {
    this.#dialog.open(VerifyRecoveryKeyDialog, { width: '480px' });
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
      await this.#userSettingsStore.deleteAccount();
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

    this.#clientKeyService.clear();

    try {
      await this.#authSession.signOut();
    } catch (error) {
      this.#logger.warn(
        'Sign out failed after account deletion scheduling',
        error,
      );
    }
    await this.#router.navigate(['/', ROUTES.LOGIN]);
  }

  async #generateAndShowRecoveryKey(): Promise<void> {
    if (this.isGeneratingRecoveryKey()) return;

    try {
      this.isGeneratingRecoveryKey.set(true);

      const { recoveryKey } = await firstValueFrom(
        this.#encryptionApi.regenerateRecoveryKey$(),
      );

      const dialogData: RecoveryKeyDialogData = { recoveryKey };
      const dialogRef = this.#dialog.open(RecoveryKeyDialog, {
        data: dialogData,
        width: '480px',
        disableClose: true,
      });

      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (confirmed) {
        this.#snackBar.open(
          this.#transloco.translate('settings.newRecoveryKeySaved'),
          'OK',
          {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          },
        );
      }
    } catch (error) {
      this.#logger.error('Failed to generate recovery key', error);
      this.#snackBar.open(
        this.#transloco.translate('settings.generateKeyError'),
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
    if (isApiError(error)) {
      if (error.status === 0) {
        return this.#transloco.translate('common.networkError');
      }

      if (error.code === 'ERR_USER_ACCOUNT_BLOCKED') {
        return this.#transloco.translate(
          'settings.alreadyScheduledForDeletion',
        );
      }
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return this.#transloco.translate('common.networkError');
      }

      const errorCode = error.error?.code;
      if (errorCode === 'ERR_USER_ACCOUNT_BLOCKED') {
        return this.#transloco.translate(
          'settings.alreadyScheduledForDeletion',
        );
      }
    }

    return this.#transloco.translate('settings.deleteError');
  }
}
