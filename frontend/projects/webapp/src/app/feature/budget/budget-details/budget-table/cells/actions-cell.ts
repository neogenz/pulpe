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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BudgetLine } from 'pulpe-shared';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../data-core';

@Component({
  selector: 'pulpe-actions-cell',
  imports: [
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="flex gap-1 justify-end items-center">
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
      @if (!line().metadata.isRollover) {
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
              <span>Éditer</span>
            </button>
          }
          @if (line().metadata.canResetFromTemplate) {
            <button
              mat-menu-item
              (click)="resetFromTemplate.emit(asBudgetLineItem())"
              [attr.data-testid]="'reset-from-template-' + line().data.id"
            >
              <mat-icon matMenuItemIcon>refresh</mat-icon>
              <span>Réinitialiser</span>
            </button>
          }
          <button
            mat-menu-item
            (click)="delete.emit(line().data.id)"
            [attr.data-testid]="'delete-' + line().data.id"
            class="text-error"
          >
            <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
            <span>Supprimer</span>
          </button>
        </mat-menu>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsCell {
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  readonly asBudgetLineItem = computed(
    () => this.line() as BudgetLineTableItem,
  );

  readonly budgetLineData = computed(() => this.line().data as BudgetLine);
}
