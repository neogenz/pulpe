import { inject, Injector, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { Asset, AssetCategory } from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { AssetCategoriesDialog } from '../components/asset-categories-dialog';
import {
  AssetFormDialog,
  type AssetFormDialogData,
} from '../components/asset-form-dialog';
import {
  AssetValueDialog,
  type AssetValueDialogData,
} from '../components/asset-value-dialog';
import type { AssetCreateRequest, AssetEditRequest } from './net-worth-store';

@Service({ autoProvided: false })
export class NetWorthDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #transloco = inject(TranslocoService);
  readonly #injector = inject(Injector);

  async openCreate(
    categories: AssetCategory[],
  ): Promise<AssetCreateRequest | undefined> {
    const dialogRef = this.#dialog.open(AssetFormDialog, {
      data: { categories } satisfies AssetFormDialogData,
      width: '560px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openEdit(
    asset: Asset,
    categories: AssetCategory[],
  ): Promise<AssetEditRequest | undefined> {
    const dialogRef = this.#dialog.open(AssetFormDialog, {
      data: { categories, asset } satisfies AssetFormDialogData,
      width: '560px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  /** Resolves with the new signed value. */
  async openValue(asset: Asset): Promise<number | undefined> {
    const dialogRef = this.#dialog.open(AssetValueDialog, {
      data: { asset } satisfies AssetValueDialogData,
      width: '480px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  // The dialog writes through the route-scoped store, so it gets this injector.
  async openCategories(): Promise<void> {
    const dialogRef = this.#dialog.open(AssetCategoriesDialog, {
      injector: this.#injector,
      width: '560px',
      maxWidth: '90vw',
    });
    await firstValueFrom(dialogRef.afterClosed());
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
