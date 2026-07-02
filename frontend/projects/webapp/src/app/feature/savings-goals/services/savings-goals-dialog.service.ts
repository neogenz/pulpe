import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type {
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalUpdate,
} from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  SavingsGoalFormDialog,
  type SavingsGoalFormDialogData,
} from '../components/savings-goal-form-dialog';

/** Sentinel returned by the form dialog when the user taps the delete action. */
export interface SavingsGoalDeleteRequest {
  delete: true;
}

export type SavingsGoalCreateResult = SavingsGoalCreate;
export type SavingsGoalEditResult =
  | SavingsGoalUpdate
  | SavingsGoalDeleteRequest;

function isDeleteRequest(
  result: SavingsGoalEditResult | undefined,
): result is SavingsGoalDeleteRequest {
  return !!result && 'delete' in result && result.delete === true;
}

@Injectable({ providedIn: 'root' })
export class SavingsGoalsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #transloco = inject(TranslocoService);

  async openCreate(): Promise<SavingsGoalCreateResult | undefined> {
    const dialogRef = this.#dialog.open(SavingsGoalFormDialog, {
      data: {} satisfies SavingsGoalFormDialogData,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openEdit(
    goal: SavingsGoal,
  ): Promise<SavingsGoalEditResult | undefined> {
    const dialogRef = this.#dialog.open(SavingsGoalFormDialog, {
      data: { goal } satisfies SavingsGoalFormDialogData,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async confirmDelete(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('savingsGoals.deleteConfirmTitle'),
        message: this.#transloco.translate('savingsGoals.deleteConfirmMessage'),
        confirmText: this.#transloco.translate('common.delete'),
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    return confirmed === true;
  }

  isDeleteRequest(
    result: SavingsGoalEditResult | undefined,
  ): result is SavingsGoalDeleteRequest {
    return isDeleteRequest(result);
  }
}
