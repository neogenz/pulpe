import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserSettingsStore } from '@core/user-settings';
import type { Transaction } from 'pulpe-shared';
import type { BudgetLine } from 'pulpe-shared';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../../view-models/table-items.view-model';

@Component({
  selector: 'pulpe-actions-cell',
  imports: [
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <div class="flex gap-1 justify-end items-center">
      @if (isCheckingEnabled()) {
        @if (line().metadata.itemType === 'budget_line') {
          <mat-slide-toggle
            [checked]="!!line().data.checkedAt"
            (change)="toggleCheck.emit(line().data.id)"
            (click)="$event.stopPropagation()"
            [attr.data-testid]="'toggle-check-' + line().data.id"
          />
        } @else if (line().metadata.itemType === 'transaction') {
          <mat-slide-toggle
            [checked]="!!line().data.checkedAt"
            (change)="toggleTransactionCheck.emit(line().data.id)"
            (click)="$event.stopPropagation()"
            [attr.data-testid]="'toggle-check-tx-' + line().data.id"
          />
        }
      }
      <button
        matIconButton
        [matMenuTriggerFor]="rowActionMenu"
        [attr.data-testid]="'actions-menu-' + line().data.id"
        [disabled]="line().metadata.isLoading"
      >
        <mat-icon>more_vert</mat-icon>
      </button>

      <mat-menu #rowActionMenu="matMenu" xPosition="before">
        <div
          class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
          [matTooltip]="line().data.name"
          matTooltipShowDelay="500"
        >
          {{ line().data.name }}
        </div>
        <mat-divider />
        @if (line().metadata.itemType === 'budget_line') {
          <button
            mat-menu-item
            (click)="addTransaction.emit(budgetLineData())"
            [attr.data-testid]="'add-transaction-' + line().data.id"
          >
            <mat-icon matMenuItemIcon>add</mat-icon>
            <span>{{ line().metadata.allocationLabel }}</span>
          </button>
          <button
            mat-menu-item
            (click)="edit.emit(asBudgetLineItem())"
            [attr.data-testid]="'edit-' + line().data.id"
          >
            <mat-icon matMenuItemIcon>edit</mat-icon>
            <span>{{ 'common.edit' | transloco }}</span>
          </button>
          @if (line().metadata.canSpread) {
            <button
              mat-menu-item
              (click)="spread.emit(asBudgetLineItem())"
              [attr.data-testid]="'spread-' + line().data.id"
            >
              <mat-icon matMenuItemIcon>calendar_month</mat-icon>
              <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
            </button>
          } @else if (showSpreadUnavailable()) {
            <!-- Tooltip lives on the wrapper: a disabled button emits no
                 pointer events, so it couldn't trigger the tooltip itself. -->
            <span
              class="block"
              [matTooltip]="
                'budgetLine.spread.spreadUnavailableRecurrent' | transloco
              "
              matTooltipPosition="above"
            >
              <button
                mat-menu-item
                disabled
                [attr.data-testid]="'spread-disabled-' + line().data.id"
              >
                <mat-icon matMenuItemIcon>calendar_month</mat-icon>
                <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
              </button>
            </span>
          }
        }
        @if (
          line().metadata.itemType === 'transaction' &&
          line().metadata.canSpread
        ) {
          <button
            mat-menu-item
            (click)="spreadTransaction.emit(asTransactionItem().data)"
            [attr.data-testid]="'spread-tx-' + line().data.id"
          >
            <mat-icon matMenuItemIcon>calendar_month</mat-icon>
            <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
          </button>
        }
        @if (line().metadata.canResetFromTemplate) {
          <button
            mat-menu-item
            (click)="resetFromTemplate.emit(asBudgetLineItem())"
            [attr.data-testid]="'reset-from-template-' + line().data.id"
          >
            <mat-icon matMenuItemIcon>refresh</mat-icon>
            <span>{{ 'budget.reset' | transloco }}</span>
          </button>
        }
        @if (line().metadata.showPostpone) {
          <!-- Tooltip wrapper: matTooltip is suppressed on disabled buttons -->
          <span
            class="block w-full"
            [matTooltip]="
              line().metadata.postponeDisabledReason
                ? (line().metadata.postponeDisabledReason
                  | transloco: { month: line().metadata.postponeTargetLabel })
                : ''
            "
          >
            <button
              mat-menu-item
              [disabled]="line().metadata.isPostponeDisabled"
              (click)="postpone.emit(line().data.id)"
              [attr.data-testid]="'postpone-' + line().data.id"
            >
              <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
              <span>{{ 'budget.postpone' | transloco }}</span>
            </button>
          </span>
        } @else if (showPostponeUnavailableRecurrent()) {
          <!-- Tooltip wrapper: matTooltip is suppressed on disabled buttons -->
          <span
            class="block w-full"
            [matTooltip]="'budget.postponeUnavailableRecurrent' | transloco"
            matTooltipPosition="above"
          >
            <button
              mat-menu-item
              disabled
              [attr.data-testid]="'postpone-disabled-' + line().data.id"
            >
              <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
              <span>{{ 'budget.postpone' | transloco }}</span>
            </button>
          </span>
        }
        <button
          mat-menu-item
          (click)="delete.emit(line().data.id)"
          [attr.data-testid]="'delete-' + line().data.id"
          class="text-error"
        >
          <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
          <span>{{ 'common.delete' | transloco }}</span>
        </button>
      </mat-menu>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsCell {
  protected readonly isCheckingEnabled =
    inject(UserSettingsStore).isCheckingEnabled;

  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly spread = output<BudgetLineTableItem>();
  readonly spreadTransaction = output<Transaction>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly postpone = output<string>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  readonly asBudgetLineItem = computed(
    () => this.line() as BudgetLineTableItem,
  );

  readonly asTransactionItem = computed(
    () => this.line() as TransactionTableItem,
  );

  readonly budgetLineData = computed(() => this.line().data as BudgetLine);

  // Recurrent (`fixed`) expense/saving lines are already laid down every month,
  // so the "Lisser" action stays disabled with an explanation instead of
  // vanishing. Income / already-spread / zero stay hidden (handled by canSpread).
  readonly showSpreadUnavailable = computed(() => {
    const item = this.line();
    if (item.metadata.itemType !== 'budget_line' || item.metadata.canSpread) {
      return false;
    }
    const data = item.data as BudgetLine;
    return data.recurrence === 'fixed' && data.kind !== 'income';
  });

  // A recurrent (`fixed`) line is regenerated every month by its template, so
  // postponing a single occurrence doesn't apply — but hiding the action
  // outright leaves the user wondering where it went (same rationale as
  // showSpreadUnavailable above). Income stays hidden too: the tooltip copy
  // is expense-specific and recurring income has no "report" mental model.
  // Transactions and other hidden budget-line cases (already has a
  // transaction, spread occurrence) stay hidden.
  readonly showPostponeUnavailableRecurrent = computed(() => {
    const item = this.line();
    if (
      item.metadata.itemType !== 'budget_line' ||
      item.metadata.showPostpone
    ) {
      return false;
    }
    const data = item.data as BudgetLine;
    return data.recurrence === 'fixed' && data.kind !== 'income';
  });
}
