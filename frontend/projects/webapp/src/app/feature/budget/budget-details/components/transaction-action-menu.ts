import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Transaction } from 'pulpe-shared';

/**
 * Contextual action menu for free transaction cards.
 * Provides edit and delete actions behind a 3-dot menu,
 * following the same pattern as BudgetActionMenu.
 */
@Component({
  selector: 'pulpe-transaction-action-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    TranslocoPipe,
  ],
  template: `
    <button
      matIconButton
      [matMenuTriggerFor]="actionMenu"
      (click)="$event.stopPropagation()"
      [attr.data-testid]="'tx-menu-' + transaction().id"
      [attr.aria-label]="'Actions pour ' + transaction().name"
      class="shrink-0"
      [class]="buttonClass()"
    >
      <mat-icon>{{ menuIcon() }}</mat-icon>
    </button>

    <mat-menu #actionMenu="matMenu" xPosition="before">
      <div
        class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
        [matTooltip]="transaction().name"
        matTooltipShowDelay="500"
      >
        {{ transaction().name }}
      </div>
      <mat-divider />
      <button
        mat-menu-item
        (click)="edit.emit(transaction())"
        [attr.data-testid]="'edit-tx-' + transaction().id"
      >
        <mat-icon matMenuItemIcon>edit</mat-icon>
        <span>{{ 'common.edit' | transloco }}</span>
      </button>
      <!-- Tooltip wrapper: matTooltip is suppressed on disabled buttons.
           Always shown — a pointed transaction is greyed with a reason, not hidden. -->
      <span
        class="block w-full"
        [matTooltip]="
          postponeDisabledReason()
            ? (postponeDisabledReason()
              | transloco: { month: nextMonthLabel() })
            : ''
        "
      >
        <button
          mat-menu-item
          [disabled]="isPostponeDisabled()"
          (click)="postpone.emit(transaction().id)"
          [attr.data-testid]="'postpone-tx-' + transaction().id"
        >
          <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
          <span>{{ 'budget.postpone' | transloco }}</span>
        </button>
      </span>
      @if (canSpread()) {
        <button
          mat-menu-item
          (click)="spread.emit(transaction())"
          [attr.data-testid]="'spread-tx-' + transaction().id"
        >
          <mat-icon matMenuItemIcon>calendar_month</mat-icon>
          <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
        </button>
      }
      <button
        mat-menu-item
        (click)="delete.emit(transaction().id)"
        [attr.data-testid]="'delete-tx-' + transaction().id"
        class="text-error"
      >
        <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
        <span>{{ 'common.delete' | transloco }}</span>
      </button>
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionActionMenu {
  readonly transaction = input.required<Transaction>();
  readonly menuIcon = input<string>('more_vert');
  readonly buttonClass = input<string>('');
  /** Whether the next calendar month's budget exists (gates postpone enablement) — PUL-22 CA5 */
  readonly hasNextMonthBudget = input<boolean>(false);
  /** Target month label for the postpone tooltip (e.g. "juillet") — PUL-22 */
  readonly nextMonthLabel = input<string>('');

  readonly edit = output<Transaction>();
  readonly delete = output<string>();
  readonly postpone = output<string>();

  // Free transactions always offer postpone; a pointed one is shown greyed with
  // a reason, the missing-next-month case too. `null` => enabled.
  protected readonly postponeDisabledReason = computed<string | null>(() => {
    if (this.transaction().checkedAt !== null) {
      return 'budget.postponeUnavailableChecked';
    }
    if (!this.hasNextMonthBudget()) {
      return 'budget.postponeDisabledTooltip';
    }
    return null;
  });
  protected readonly isPostponeDisabled = computed(
    () => this.postponeDisabledReason() !== null,
  );
  readonly spread = output<Transaction>();

  /**
   * PUL-17 v1.1 — a FREE transaction (`budgetLineId == null`), non-revenu,
   * positive amount can be smoothed over several months. Allocated txns derive
   * their spread from the parent envelope line, never from the txn itself.
   */
  protected readonly canSpread = computed(() => {
    const tx = this.transaction();
    return tx.budgetLineId == null && tx.kind !== 'income' && tx.amount > 0;
  });
}
