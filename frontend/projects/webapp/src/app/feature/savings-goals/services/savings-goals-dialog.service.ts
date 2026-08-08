import { inject, Service } from '@angular/core';
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
import {
  GoalPlanApplyDialog,
  type GoalPlanApplyDialogData,
  type GoalPlanWithdrawalDestination,
} from '../detail/components/goal-plan-apply-dialog';
import {
  GoalGenerationStopDialog,
  type GoalGenerationStopDecision,
  type GoalGenerationStopDialogData,
} from '../detail/components/goal-generation-stop-dialog';

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
  ): Promise<GoalPlanWithdrawalDestination | true | undefined> {
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
