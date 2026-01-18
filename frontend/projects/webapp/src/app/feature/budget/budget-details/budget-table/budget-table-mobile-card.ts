import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { type BudgetLine } from 'pulpe-shared';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { type BudgetLineTableItem } from './budget-table-models';

/**
 * Mobile card component for displaying a single budget line
 * "Breathing Cards" design with asymmetric layout and status strip
 */
@Component({
  selector: 'pulpe-budget-table-mobile-card',
  imports: [
    MatCardModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    RouterLink,
    CurrencyPipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="!rounded-2xl"
      [class.opacity-60]="item().metadata.isLoading"
      [attr.data-testid]="
        'envelope-card-' + (item().data.name | rolloverFormat)
      "
    >
      <mat-card-content class="p-4">
        <!-- Row 1: Name and Menu -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <!-- Colored indicator dot -->
            <div
              class="w-3 h-3 rounded-full flex-shrink-0"
              [style.background-color]="
                item().data.kind === 'income'
                  ? 'var(--pulpe-financial-income)'
                  : item().data.kind === 'expense'
                    ? 'var(--pulpe-financial-expense)'
                    : 'var(--pulpe-financial-savings)'
              "
              [matTooltip]="item().data.kind | transactionLabel"
            ></div>
            <span
              class="text-title-medium font-medium truncate"
              [class.line-through]="item().data.checkedAt"
              [class.text-on-surface-variant]="item().data.checkedAt"
            >
              @if (
                item().metadata.isRollover &&
                item().metadata.rolloverSourceBudgetId
              ) {
                <a
                  [routerLink]="[
                    '/budget',
                    item().metadata.rolloverSourceBudgetId,
                  ]"
                  class="text-primary underline-offset-2 hover:underline"
                >
                  {{ item().data.name | rolloverFormat }}
                </a>
              } @else {
                {{ item().data.name | rolloverFormat }}
              }
            </span>
            @if (item().metadata.isPropagationLocked) {
              <mat-icon
                class="text-sm! text-outline shrink-0"
                matTooltip="Montants verrouillés"
              >
                lock
              </mat-icon>
            }
          </div>
          @if (!item().metadata.isRollover) {
            <button
              matIconButton
              [matMenuTriggerFor]="cardActionMenu"
              [attr.data-testid]="'card-menu-' + item().data.id"
              class="shrink-0 !-mr-2 !-mt-1"
            >
              <mat-icon>more_horiz</mat-icon>
            </button>

            <mat-menu #cardActionMenu="matMenu" xPosition="before">
              <div
                class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
                [matTooltip]="item().data.name"
                matTooltipShowDelay="500"
              >
                {{ item().data.name }}
              </div>
              <div class="px-4 pb-2 text-label-medium">
                Solde:
                {{
                  item().metadata.cumulativeBalance
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </div>
              <mat-divider />
              <button
                mat-menu-item
                (click)="addTransaction.emit(item().data)"
                [attr.data-testid]="'add-transaction-' + item().data.id"
              >
                <mat-icon matMenuItemIcon>add</mat-icon>
                <span>{{ item().metadata.allocationLabel }}</span>
              </button>
              <button
                mat-menu-item
                (click)="edit.emit(item())"
                [attr.data-testid]="'edit-' + item().data.id"
              >
                <mat-icon matMenuItemIcon>edit</mat-icon>
                <span>Éditer</span>
              </button>
              @if (item().metadata.canResetFromTemplate) {
                <button
                  mat-menu-item
                  (click)="resetFromTemplate.emit(item())"
                  [attr.data-testid]="'reset-from-template-' + item().data.id"
                >
                  <mat-icon matMenuItemIcon>refresh</mat-icon>
                  <span>Réinitialiser</span>
                </button>
              }
              <button
                mat-menu-item
                (click)="delete.emit(item().data.id)"
                [attr.data-testid]="'delete-' + item().data.id"
                class="text-error"
              >
                <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
                <span>Supprimer</span>
              </button>
            </mat-menu>
          }
        </div>

        <!-- Row 2: Amount prominently left-aligned with consumption on right -->
        <div class="flex items-end justify-between mb-4">
          <div>
            <div
              class="text-headline-medium font-bold"
              [class.text-financial-income]="item().data.kind === 'income'"
              [class.text-financial-expense]="item().data.kind === 'expense'"
              [class.text-financial-savings]="item().data.kind === 'saving'"
            >
              {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
            </div>
            <span class="text-label-small text-on-surface-variant">prévu</span>
          </div>

          <!-- Consumption mini-stat if applicable -->
          @if (item().consumption?.hasTransactions) {
            <div class="text-right">
              <div class="text-title-medium font-semibold text-on-surface">
                {{
                  item().consumption!.consumed
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </div>
              <span class="text-label-small text-on-surface-variant"
                >dépensé</span
              >
            </div>
          }
        </div>

        <!-- Row 3: Segmented Progress (if applicable) -->
        @if (
          item().consumption?.hasTransactions && !item().metadata.isRollover
        ) {
          <div class="mb-4">
            <div class="flex gap-0.5 h-1.5">
              @for (i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; track i) {
                <div
                  class="flex-1 rounded-full transition-colors"
                  [class.bg-primary]="
                    i <= item().consumption!.percentage / 10 &&
                    item().consumption!.percentage <= 100
                  "
                  [class.bg-error]="item().consumption!.percentage > 100"
                  [class.bg-outline-variant/40]="
                    i > item().consumption!.percentage / 10 ||
                    (item().consumption!.percentage > 100 && i > 10)
                  "
                ></div>
              }
            </div>
            <div
              class="text-label-small text-on-surface-variant text-center mt-1.5"
            >
              @if (item().consumption!.percentage > 100) {
                Dépassé de
                {{
                  item().consumption!.consumed - item().data.amount
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              } @else {
                {{ item().consumption!.percentage }}% utilisé
              }
            </div>
          </div>
        }

        <!-- Row 4: Actions footer -->
        @if (!item().metadata.isRollover) {
          <div
            class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
          >
            <mat-chip class="!h-6 !text-label-small bg-surface-container">
              {{ item().data.recurrence | recurrenceLabel }}
            </mat-chip>

            <div class="flex items-center gap-2">
              @if (item().consumption?.hasTransactions) {
                <button
                  matButton
                  class="!h-8 !px-3 !rounded-full !min-w-0"
                  [matBadge]="item().consumption!.transactionCount"
                  matBadgeColor="primary"
                  matBadgeSize="small"
                  (click)="viewTransactions.emit(item())"
                  matTooltip="Voir les transactions"
                >
                  <mat-icon class="!text-lg">receipt_long</mat-icon>
                </button>
              } @else {
                <button
                  matButton
                  class="!h-8 !px-3 !rounded-full text-primary"
                  (click)="addTransaction.emit(item().data)"
                >
                  <mat-icon class="!text-base mr-1">add</mat-icon>
                  Saisir
                </button>
              }

              <mat-slide-toggle
                [checked]="!!item().data.checkedAt"
                (change)="toggleCheck.emit(item().data.id)"
                (click)="$event.stopPropagation()"
                [attr.data-testid]="'toggle-check-' + item().data.id"
              />
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTableMobileCard {
  // Input - pre-computed ViewModel
  readonly item = input.required<BudgetLineTableItem>();

  // Outputs
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
}
