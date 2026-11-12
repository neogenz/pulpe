import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { Asset, AssetCategory } from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  AssetFormDialog,
  type AssetFormDialogData,
} from '../components/asset-form-dialog';
import type { AssetCreateRequest, AssetEditRequest } from './net-worth-store';

@Service({ autoProvided: false })
export class NetWorthDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #transloco = inject(TranslocoService);
  readonly #breakpoints = inject(BreakpointObserver);

  async openCreate(
    categories: AssetCategory[],
    assets: Asset[],
  ): Promise<AssetCreateRequest | undefined> {
    return this.#openForm({ categories, assets });
  }

  /** Resolves with what changed, or nothing when the sheet was left untouched. */
  async openEdit(
    asset: Asset,
    categories: AssetCategory[],
    assets: Asset[],
  ): Promise<AssetEditRequest | undefined> {
    return this.#openForm({ categories, assets, asset });
  }

  // Full screen on a phone: the fields would not fit a centred card above a keyboard.
  #openForm<Result>(
    data: Omit<AssetFormDialogData, 'isFullScreen'>,
  ): Promise<Result | undefined> {
    const isFullScreen = this.#breakpoints.isMatched(Breakpoints.Handset);
    const dialogRef = this.#dialog.open(AssetFormDialog, {
      data: { ...data, isFullScreen } satisfies AssetFormDialogData,
      ...(isFullScreen
        ? {
            panelClass: 'full-screen-dialog',
            width: '100dvw',
            maxWidth: '100dvw',
            height: '100dvh',
            maxHeight: '100dvh',
          }
        : { width: '560px', maxWidth: 'calc(100vw - 48px)' }),
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async confirmDelete(asset: Asset): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('netWorth.deleteTitle', {
          name: asset.name,
        }),
        message: this.#transloco.translate('netWorth.deleteMessage'),
        confirmText: this.#transloco.translate('common.delete'),
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
      maxWidth: '90vw',
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }
}
