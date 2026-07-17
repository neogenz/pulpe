import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';

@Injectable()
export class SettingsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #transloco = inject(TranslocoService);

  /**
   * PUL-205: a currency flip changes only the display unit — amounts are never
   * converted. The confirmation makes that explicit before persisting.
   */
  async confirmCurrencyChange(
    newCurrency: SupportedCurrency,
  ): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('settings.currencyChangeTitle'),
        message: this.#transloco.translate('settings.currencyChangeMessage', {
          symbol: CURRENCY_METADATA[newCurrency].symbol,
        }),
        confirmText: this.#transloco.translate(
          'settings.currencyChangeConfirm',
        ),
        cancelText: this.#transloco.translate('common.cancel'),
      } satisfies ConfirmationDialogData,
      width: '400px',
      autoFocus: '[data-testid="confirmation-confirm-button"]',
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }
}
