import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { type BudgetLine } from 'pulpe-shared';
import { FinancialKindDirective } from '@ui/financial-kind';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import type { BudgetLineTableItem } from '../data-core';
import { BudgetProgressBar } from '../components/budget-progress-bar';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { BudgetActionMenu } from '../components/budget-action-menu';

/**
 * Ultra-compact list row for budget lines.
 *
 * Layout (~44px height):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ ● 3ème pilier            ████░░  580 CHF   [+] [🧾] ⋯ ○──  │
 * └─────────────────────────────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-list-row',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
    MatSlideToggleModule,
    RouterLink,
    CurrencyPipe,
    FinancialKindDirective,
    RolloverFormatPipe,
    BudgetProgressBar,
    BudgetKindIndicator,
    BudgetActionMenu,
  ],
  template: `
    <div
      matRipple
      class="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low transition-colors cursor-pointer border-b border-outline-variant/30 last:border-b-0"
      [class.opacity-60]="item().metadata.isLoading"
      [class.bg-surface-container-lowest]="isEven()"
      (click)="onRowClick()"
      (keydown.enter)="onRowClick()"
      (keydown.space)="onRowClick()"
      role="button"
      tabindex="0"
      [attr.data-testid]="'envelope-row-' + item().data.id"
    >
      <!-- Kind indicator -->
      <pulpe-budget-kind-indicator [kind]="item().data.kind" [size]="8" />

      <!-- Name (flex-1) -->
      <div class="flex-1 min-w-0">
        <span
          class="text-body-medium truncate block"
          [class.line-through]="item().data.checkedAt"
          [class.text-on-surface-variant]="item().data.checkedAt"
        >
          @if (
            item().metadata.isRollover && item().metadata.rolloverSourceBudgetId
          ) {
            <a
              [routerLink]="['/budget', item().metadata.rolloverSourceBudgetId]"
              class="text-primary hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ item().data.name | rolloverFormat }}
            </a>
          } @else {
            {{ item().data.name | rolloverFormat }}
          }
        </span>
      </div>

      <!-- Progress bar (desktop only, compact) -->
      @if (item().consumption?.hasTransactions && !item().metadata.isRollover) {
        <div class="w-16 hidden md:block shrink-0">
          <pulpe-budget-progress-bar
            [percentage]="item().consumption!.percentage"
            [segmentCount]="6"
            [height]="4"
          />
        </div>
      }

      <!-- Amount -->
      <div
        class="text-body-medium font-semibold tabular-nums w-20 text-right shrink-0"
        [pulpeFinancialKind]="item().data.kind"
      >
        {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
      </div>

      <!-- Actions: toggle → menu (standard order) -->
      @if (!item().metadata.isRollover) {
        <div class="flex items-center gap-1 shrink-0">
          <!-- Toggle (primary action) -->
          <mat-slide-toggle
            class="!scale-75"
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

          <!-- Menu (secondary actions) -->
          <pulpe-budget-action-menu
            [item]="item()"
            menuIcon="more_vert"
            buttonClass="!size-8"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
            (addTransaction)="addTransaction.emit($event)"
            (resetFromTemplate)="resetFromTemplate.emit($event)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetListRow {
  readonly item = input.required<BudgetLineTableItem>();
  readonly isEven = input<boolean>(false);

  readonly rowClick = output<BudgetLineTableItem>();
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();

  protected onRowClick(): void {
    this.rowClick.emit(this.item());
  }
}
