import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type {
  TemplateLinesPropagationSummary,
  TemplateUsageResponse,
} from 'pulpe-shared';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateUsageDialogComponent } from './components/dialogs/template-usage-dialog';
import {
  TemplatePropagationDialog,
  type TemplatePropagationChoice,
} from './details/components/template-propagation-dialog';

type TemplateUsageBudgets = TemplateUsageResponse['data']['budgets'];

@Injectable()
export class BudgetTemplatesDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  async openDeleteConfirmation(templateName: string): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('template.deleteTitle'),
        message: this.#transloco.translate('template.deleteConfirm', {
          name: templateName,
        }),
        confirmText: this.#transloco.translate('common.delete'),
        cancelText: this.#transloco.translate('common.cancel'),
        confirmColor: 'warn' as const,
      },
      width: '400px',
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  async openUsageDialog(
    templateId: string,
    templateName: string,
    budgets: TemplateUsageBudgets,
  ): Promise<void> {
    const dialogRef = this.#dialog.open(TemplateUsageDialogComponent, {
      data: { templateId, templateName },
      width: '90vw',
      maxWidth: '600px',
      disableClose: false,
    });
    dialogRef.componentInstance.setUsageData(budgets);
    await firstValueFrom(dialogRef.afterClosed());
  }

  async openPropagationDialog(
    templateName: string,
  ): Promise<TemplatePropagationChoice | null> {
    const result = await firstValueFrom(
      this.#dialog
        .open<
          TemplatePropagationDialog,
          { templateName: string },
          TemplatePropagationChoice | null
        >(TemplatePropagationDialog, {
          data: { templateName },
          width: '520px',
          maxWidth: '95vw',
        })
        .afterClosed(),
    );
    return result ?? null;
  }

  notifyTemplateDeleted(): void {
    this.#snackBar.open(
      this.#transloco.translate('template.deleted'),
      undefined,
      { duration: 3000 },
    );
  }

  notifyTemplateDeleteError(): void {
    this.#snackBar.open(
      this.#transloco.translate('template.deleteCheckError'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  notifyVerificationError(): void {
    this.#snackBar.open(
      this.#transloco.translate('template.verificationCheckError'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  notifyMutationError(): void {
    this.#snackBar.open(
      this.#transloco.translate('template.saveError'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  notifyMutationSuccess(
    baseKey: string,
    propagation: TemplateLinesPropagationSummary | null,
  ): void {
    const message = this.#buildSuccessMessage(baseKey, propagation);
    this.#snackBar.open(message, undefined, { duration: 4000 });
  }

  #buildSuccessMessage(
    baseKey: string,
    propagation: TemplateLinesPropagationSummary | null,
  ): string {
    if (!propagation || propagation.mode !== 'propagate') {
      return this.#transloco.translate(baseKey);
    }
    if (propagation.affectedBudgetsCount > 0) {
      const key =
        propagation.affectedBudgetsCount === 1
          ? 'template.updatedWithBudgetsSingular'
          : 'template.updatedWithBudgetsPlural';
      return this.#transloco.translate(key, {
        count: propagation.affectedBudgetsCount,
      });
    }
    return this.#transloco.translate(baseKey);
  }
}
