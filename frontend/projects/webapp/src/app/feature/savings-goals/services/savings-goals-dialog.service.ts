import { inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type {
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalDeletionCommand,
  SavingsGoalUpdate,
  SupportedCurrency,
} from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  SavingsGoalFormDialog,
  type SavingsGoalFormDialogData,
} from '../components/savings-goal-form-dialog';
import {
  GoalPlanApplyDialog,
  type GoalPlanApplyDialogData,
} from '../detail/components/goal-plan-apply-dialog';
import {
  GoalGenerationStopDialog,
  type GoalGenerationStopDecision,
  type GoalGenerationStopDialogData,
} from '../detail/components/goal-generation-stop-dialog';
import {
  GoalDeletionDialog,
  type GoalDeletionDialogData,
} from '../detail/components/goal-deletion-dialog';

@Service({ autoProvided: false })
export class SavingsGoalsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #transloco = inject(TranslocoService);

  async openCreate(): Promise<SavingsGoalCreate | undefined> {
    const dialogRef = this.#dialog.open(SavingsGoalFormDialog, {
      data: {} satisfies SavingsGoalFormDialogData,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openEdit(goal: SavingsGoal): Promise<SavingsGoalUpdate | undefined> {
    const dialogRef = this.#dialog.open(SavingsGoalFormDialog, {
      data: { goal } satisfies SavingsGoalFormDialogData,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openApplyPlan(
    data: GoalPlanApplyDialogData,
  ): Promise<boolean | undefined> {
    const dialogRef = this.#dialog.open(GoalPlanApplyDialog, {
      data,
      width: '480px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openGenerationStop(
    data: GoalGenerationStopDialogData,
  ): Promise<GoalGenerationStopDecision | undefined> {
    const dialogRef = this.#dialog.open(GoalGenerationStopDialog, {
      data,
      width: '480px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openDeletion(data: {
    goalId: string;
    goalName: string;
    currency: SupportedCurrency;
    locale: string;
    payDayOfMonth: number | null;
  }): Promise<SavingsGoalDeletionCommand | undefined> {
    const dialogRef = this.#dialog.open(GoalDeletionDialog, {
      data: data satisfies GoalDeletionDialogData,
      width: '720px',
      maxWidth: '95vw',
      height: '90dvh',
      maxHeight: '90dvh',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  /** « Abandonner tes ajustements ? » — exit the simulator with pending changes. */
  async confirmDiscardChanges(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('savingsGoals.simulate.discardTitle'),
        message: this.#transloco.translate(
          'savingsGoals.simulate.discardMessage',
        ),
        confirmText: this.#transloco.translate('savingsGoals.simulate.discard'),
      } satisfies ConfirmationDialogData,
      width: '400px',
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    return confirmed === true;
  }
}
