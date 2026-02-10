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
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { type BudgetLine } from 'pulpe-shared';
import { FinancialKindDirective } from '@ui/financial-kind';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import type { BudgetLineTableItem } from '../data-core';
import { BudgetProgressBar } from '../components/budget-progress-bar';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { BudgetActionMenu } from '../components/budget-action-menu';

/**
 * Compact budget line card component for both mobile and desktop.
 *
 * Layout (compact, ~100px height):
 * ┌──────────────────────────────────────────┐
 * │ ● Récurrent                  ⋯    prévu  │
 * │ 3ème pilier                              │
 * │ 580 CHF   ████░░░░  [+] [🧾]      ○────  │
 * └──────────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-grid-card',
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    RouterLink,
    CurrencyPipe,
    FinancialKindDirective,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
    BudgetProgressBar,
    BudgetKindIndicator,
    BudgetActionMenu,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="!rounded-xl"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      [class.cursor-pointer]="!isMobile()"
      [attr.role]="isMobile() ? null : 'button'"
      [attr.tabindex]="isMobile() ? null : 0"
      (click)="onCardClick()"
      (keydown.enter)="onCardClick()"
      (keydown.space)="onCardClick()"
      [attr.data-testid]="'envelope-card-' + item().data.id"
    >
      <mat-card-content class="p-3">
        <!-- Row 1: Metadata — kind dot + recurrence chip + menu + label -->
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <pulpe-budget-kind-indicator [kind]="item().data.kind" [size]="8" />
            @if (!item().metadata.isRollover) {
              <span class="text-label-small text-on-surface-variant">
                {{ item().data.recurrence | recurrenceLabel }}
              </span>
            }
            @if (item().metadata.isPropagationLocked) {
              <mat-icon
                class="text-xs! text-outline"
                matTooltip="Montants verrouillés"
              >
                lock
              </mat-icon>
            }
          </div>
          <div class="flex items-center gap-1">
            @if (!item().metadata.isRollover) {
              <pulpe-budget-action-menu
                [item]="item()"
                [menuIcon]="isMobile() ? 'more_horiz' : 'more_vert'"
                buttonClass="!size-7 !-mr-1"
                [showBalance]="isMobile()"
                (edit)="edit.emit($event)"
                (delete)="delete.emit($event)"
                (addTransaction)="addTransaction.emit($event)"
                (resetFromTemplate)="resetFromTemplate.emit($event)"
              />
            }
            <span class="text-label-small text-on-surface-variant">prévu</span>
          </div>
        </div>

        <!-- Row 2: Name (truncated) -->
        <div class="mb-1.5 min-w-0">
          <span
            class="text-body-medium font-medium block truncate"
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
        </div>

        <!-- Row 3: Amount + Progress + Actions — all on one line -->
        <div class="flex items-center justify-between gap-2">
          <!-- Amount -->
          <div
            class="text-title-medium font-bold shrink-0"
            [pulpeFinancialKind]="item().data.kind"
          >
            {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
          </div>

          <!-- Progress bar (inline, small) -->
          @if (
            item().consumption?.hasTransactions && !item().metadata.isRollover
          ) {
            <div class="flex-1 max-w-24 hidden sm:block">
              <pulpe-budget-progress-bar
                [percentage]="item().consumption!.percentage"
                [segmentCount]="8"
                [height]="4"
              />
            </div>
          }

          <!-- Actions -->
          @if (!item().metadata.isRollover) {
            <div class="flex items-center gap-1">
              <button
                matIconButton
                class="!size-8 text-primary"
                (click)="onAddTransaction($event)"
                matTooltip="Saisir une transaction"
                [attr.data-testid]="'add-transaction-' + item().data.id"
              >
                <mat-icon class="text-lg!">add</mat-icon>
              </button>

              @if (item().consumption?.hasTransactions) {
                <button
                  matIconButton
                  class="!size-8"
                  (click)="onViewTransactions($event)"
                  [matTooltip]="item().consumption!.transactionCountLabel"
                  [attr.data-testid]="'view-tx-' + item().data.id"
                >
                  <mat-icon
                    class="text-lg!"
                    [matBadge]="item().consumption!.transactionCount"
                    matBadgeSize="small"
                    matBadgeColor="primary"
                  >
                    receipt_long
                  </mat-icon>
                </button>
              }

              <mat-slide-toggle
                class="!scale-90"
                [checked]="!!item().data.checkedAt"
                (change)="toggleCheck.emit(item().data.id)"
                (click)="$event.stopPropagation()"
                [attr.data-testid]="'toggle-check-' + item().data.id"
                [attr.aria-label]="
                  item().data.checkedAt
                    ? 'Marquer comme non vérifié'
                    : 'Marquer comme vérifié'
                "
              />
            </div>
          }
        </div>
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
export class BudgetGridCard {
  readonly item = input.required<BudgetLineTableItem>();
  readonly isSelected = input<boolean>(false);
  readonly isMobile = input<boolean>(false);

  readonly cardClick = output<BudgetLineTableItem>();
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();

  protected onCardClick(): void {
    if (!this.isMobile()) {
      this.cardClick.emit(this.item());
    }
  }

  protected onViewTransactions(event: Event): void {
    event.stopPropagation();
    this.viewTransactions.emit(this.item());
  }

  protected onAddTransaction(event: Event): void {
    event.stopPropagation();
    this.addTransaction.emit(this.item().data);
  }
}
