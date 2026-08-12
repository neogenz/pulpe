import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import type { BudgetLine } from 'pulpe-shared';
import type { BudgetLineTableItem } from '../view-models/table-items.view-model';

/** Shared action list for a budget line, rendered in menus and detail panels. */
@Component({
  selector: 'pulpe-budget-line-action-list',
  imports: [MatIconModule, MatMenuModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (showAddTransaction() && !item().data.sourceSavingsGoalId) {
      <button
        mat-menu-item
        (click)="addTransaction.emit(item().data)"
        [attr.data-testid]="'add-transaction-' + item().data.id"
      >
        <mat-icon matMenuItemIcon>add</mat-icon>
        <span>{{ item().metadata.allocationLabel }}</span>
      </button>
    }
    @if (showEdit()) {
      <button
        mat-menu-item
        (click)="edit.emit(item())"
        [attr.data-testid]="'edit-' + item().data.id"
      >
        <mat-icon matMenuItemIcon>edit</mat-icon>
        <span>{{ 'budget.modify' | transloco }}</span>
      </button>
    }
    @if (item().metadata.canSpread) {
      <button
        mat-menu-item
        (click)="spread.emit(item())"
        [attr.data-testid]="'spread-' + item().data.id"
      >
        <mat-icon matMenuItemIcon>calendar_month</mat-icon>
        <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
      </button>
    } @else if (showSpreadUnavailable()) {
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
          [attr.data-testid]="'spread-disabled-' + item().data.id"
        >
          <mat-icon matMenuItemIcon>calendar_month</mat-icon>
          <span>{{ 'budgetLine.spread.spreadAction' | transloco }}</span>
        </button>
      </span>
    }
    @if (item().metadata.canResetFromTemplate) {
      <button
        mat-menu-item
        (click)="resetFromTemplate.emit(item())"
        [attr.data-testid]="'reset-from-template-' + item().data.id"
      >
        <mat-icon matMenuItemIcon>refresh</mat-icon>
        <span>{{ 'budget.reset' | transloco }}</span>
      </button>
    }
    @if (item().metadata.showPostpone) {
      <span
        class="block w-full"
        [matTooltip]="
          item().metadata.postponeDisabledReason
            ? (item().metadata.postponeDisabledReason
              | transloco: { month: item().metadata.postponeTargetLabel })
            : ''
        "
      >
        <button
          mat-menu-item
          [disabled]="item().metadata.isPostponeDisabled"
          (click)="postpone.emit(item().data.id)"
          [attr.data-testid]="'postpone-' + item().data.id"
        >
          <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
          <span>{{ 'budget.postpone' | transloco }}</span>
        </button>
      </span>
    } @else if (showPostponeUnavailableRecurrent()) {
      <span
        class="block w-full"
        [matTooltip]="'budget.postponeUnavailableRecurrent' | transloco"
        matTooltipPosition="above"
      >
        <button
          mat-menu-item
          disabled
          [attr.data-testid]="'postpone-disabled-' + item().data.id"
        >
          <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
          <span>{{ 'budget.postpone' | transloco }}</span>
        </button>
      </span>
    }
    @if (showDelete()) {
      <button
        mat-menu-item
        (click)="delete.emit(item().data.id)"
        [attr.data-testid]="'delete-' + item().data.id"
        class="text-error"
      >
        <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
        <span>{{ 'common.delete' | transloco }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetLineActionList {
  readonly item = input.required<BudgetLineTableItem>();
  readonly showAddTransaction = input(true);
  readonly showEdit = input(true);
  readonly showDelete = input(true);

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly spread = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly postpone = output<string>();

  protected readonly showSpreadUnavailable = computed(() => {
    const { data, metadata } = this.item();
    if (metadata.canSpread) return false;
    return data.recurrence === 'fixed' && data.kind !== 'income';
  });

  protected readonly showPostponeUnavailableRecurrent = computed(() => {
    const { data, metadata } = this.item();
    if (metadata.showPostpone) return false;
    return data.recurrence === 'fixed' && data.kind !== 'income';
  });
}
