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
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
 * Uses pre-computed display values from the ViewModel
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
    MatProgressBarModule,
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
      [class.opacity-50]="item().metadata.isLoading"
      [attr.data-testid]="
        'envelope-card-' + (item().data.name | rolloverFormat)
      "
    >
      <!-- Header -->
      <mat-card-header class="pb-2">
        <div class="flex items-center justify-between gap-2 w-full">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <mat-icon
              class="text-base! shrink-0"
              [class.text-financial-income]="item().data.kind === 'income'"
              [class.text-financial-expense]="item().data.kind === 'expense'"
              [class.text-financial-savings]="item().data.kind === 'saving'"
              [matTooltip]="item().data.kind | transactionLabel"
            >
              {{ item().metadata.kindIcon }}
            </mat-icon>
            <span
              class="text-title-medium font-medium truncate"
              [class.italic]="item().metadata.isRollover"
              [class.line-through]="item().data.checkedAt"
              [class.text-financial-income]="item().data.kind === 'income'"
              [class.text-financial-expense]="item().data.kind === 'expense'"
              [class.text-financial-savings]="item().data.kind === 'saving'"
            >
              @if (
                item().metadata.isRollover &&
                item().metadata.rolloverSourceBudgetId
              ) {
                <a
                  [routerLink]="[
                    '/app/budget',
                    item().metadata.rolloverSourceBudgetId,
                  ]"
                  class="text-primary underline"
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
              class="shrink-0"
            >
              <mat-icon>more_vert</mat-icon>
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
                <span class="font-mono">{{
                  item().metadata.cumulativeBalance
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}</span>
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
      </mat-card-header>

      <mat-card-content class="pt-0">
        <!-- Amount display -->
        <div class="text-center py-2 mb-3">
          <div
            class="text-headline-medium font-bold font-mono"
            [class.text-financial-income]="item().data.kind === 'income'"
            [class.text-financial-expense]="item().data.kind === 'expense'"
            [class.text-financial-savings]="item().data.kind === 'saving'"
          >
            {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
          </div>
          <div class="text-label-medium text-on-surface-variant">prévu</div>
        </div>

        @if (item().consumption; as consumption) {
          @if (consumption.hasTransactions) {
            <!-- Progress bar -->
            <div class="mb-3">
              <mat-progress-bar
                mode="determinate"
                [value]="
                  consumption.percentage > 100 ? 100 : consumption.percentage
                "
                [class.warn-bar]="consumption.percentage > 100"
                class="h-2! rounded-full"
              />
              <div
                class="text-label-small text-on-surface-variant text-center mt-1"
              >
                {{ consumption.percentage }}% utilisé
              </div>
            </div>
          }
        }

        <!-- Footer: Chip + Toggle + Action -->
        @if (!item().metadata.isRollover) {
          <div
            class="flex items-center justify-between pt-3 border-t border-outline-variant"
          >
            <mat-chip
              class="h-6! text-label-small! bg-secondary-container! chip-on-secondary-container"
            >
              {{ item().data.recurrence | recurrenceLabel }}
            </mat-chip>

            <mat-slide-toggle
              [checked]="!!item().data.checkedAt"
              (change)="toggleCheck.emit(item().data.id)"
              (click)="$event.stopPropagation()"
              [attr.data-testid]="'toggle-check-' + item().data.id"
            />

            @if (item().consumption; as consumption) {
              @if (consumption.hasTransactions) {
                <button
                  matButton
                  class="h-8!"
                  [matBadge]="consumption.transactionCount"
                  matBadgeColor="primary"
                  (click)="viewTransactions.emit(item())"
                >
                  <mat-icon class="text-base! m-0!">receipt_long</mat-icon>
                </button>
              }
            }
            @if (!item().consumption?.hasTransactions) {
              <button
                matButton
                class="h-8!"
                (click)="addTransaction.emit(item().data)"
              >
                <mat-icon class="text-base!">add</mat-icon>
                Saisir
              </button>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @reference "tailwindcss";
    :host {
      display: block;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }

    .chip-on-secondary-container {
      --mat-chip-label-text-color: var(--mat-sys-on-secondary-container);
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
