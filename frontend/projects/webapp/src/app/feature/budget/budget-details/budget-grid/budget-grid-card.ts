import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { type BudgetLine } from 'pulpe-shared';
import { FinancialKindDirective } from '@ui/financial-kind';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { formatMatchAnnotation, type BudgetLineTableItem } from '../data-core';
import { BudgetProgressBar } from '../components/budget-progress-bar';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { BudgetActionMenu } from '../components/budget-action-menu';

/**
 * Desktop envelope card component following M3 Expressive design
 *
 * Visual structure:
 * ┌─────────────────────────────────────────────────┐
 * │ ● Courses alimentaires                    ⋮     │
 * │        CHF 500                                  │
 * │        prévu ce mois                            │
 * │  ████████████░░░░░░░░  80%                      │
 * │  CHF 400 dépensé                    80%         │
 * │  ┌──────────┐                       ○────       │
 * │  │ Récurrent │                                  │
 * │  └──────────┘                                   │
 * └─────────────────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-grid-card',
  imports: [
    MatBadgeModule,
    MatChipsModule,
    MatSlideToggleModule,
    CurrencyPipe,
    FinancialKindDirective,
    RecurrenceLabelPipe,
    BudgetProgressBar,
    BudgetKindIndicator,
    BudgetActionMenu,
  ],
  template: `
    <div
      class="bg-surface rounded-2xl border border-outline-variant/50 p-5 cursor-pointer
             transition-all duration-200 hover:shadow-md hover:border-outline-variant
             min-h-[200px] h-full flex flex-col"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      [matBadge]="item().consumption?.transactionCount"
      [matBadgeHidden]="!item().consumption?.hasTransactions"
      matBadgeColor="primary"
      matBadgePosition="above after"
      role="button"
      tabindex="0"
      (click)="cardClick.emit(item())"
      (keydown.enter)="cardClick.emit(item())"
      (keydown.space)="cardClick.emit(item())"
      [attr.data-testid]="'envelope-card-' + item().data.id"
    >
      <!-- Header: Name + Menu -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <pulpe-budget-kind-indicator [kind]="item().data.kind" />
          <span
            class="text-title-medium font-medium truncate"
            [class.line-through]="item().data.checkedAt"
            [class.text-on-surface-variant]="item().data.checkedAt"
          >
            {{ item().data.name }}
          </span>
        </div>

        @if (!item().metadata.isRollover) {
          <pulpe-budget-action-menu
            [item]="item()"
            buttonClass="!-mr-2 !-mt-1"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
            (addTransaction)="addTransaction.emit($event)"
            (resetFromTemplate)="resetFromTemplate.emit($event)"
          />
        }
      </div>

      @if (matchAnnotation()) {
        <p
          class="text-label-small text-on-surface-variant -mt-2 mb-3 ml-8 truncate"
        >
          ↳ {{ matchAnnotation() }}
        </p>
      }

      <!-- Hero Amount -->
      <div class="text-center mb-4 flex-1 flex flex-col justify-center">
        <div
          class="text-headline-large font-bold"
          [pulpeFinancialKind]="item().data.kind"
        >
          {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
        </div>
        <span class="text-label-medium text-on-surface-variant">prévu</span>
      </div>

      <!-- Segmented Progress -->
      @if (item().consumption?.hasTransactions && !item().metadata.isRollover) {
        <div class="mb-4">
          <pulpe-budget-progress-bar
            [percentage]="item().consumption!.percentage"
            [segmentCount]="10"
            [height]="8"
          />
          <div class="flex justify-between items-center mt-2">
            <span class="text-body-small text-on-surface-variant">
              {{
                item().consumption!.consumed
                  | currency: 'CHF' : 'symbol' : '1.0-0'
              }}
              dépensé
            </span>
            <span class="text-body-small font-medium">
              @if (item().consumption!.percentage > 100) {
                <span class="text-error">dépassé</span>
              } @else {
                {{ item().consumption!.percentage }}%
              }
            </span>
          </div>
        </div>
      }

      <!-- Footer: Chip + Toggle -->
      @if (!item().metadata.isRollover) {
        <div
          class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
        >
          <mat-chip class="!h-6 !text-label-small bg-surface-container">
            {{ item().data.recurrence | recurrenceLabel }}
          </mat-chip>

          <mat-slide-toggle
            [checked]="!!item().data.checkedAt"
            (change)="toggleCheck.emit(item().data.id)"
            (click)="$event.stopPropagation()"
            [attr.data-testid]="'toggle-check-' + item().data.id"
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
export class BudgetGridCard {
  readonly item = input.required<BudgetLineTableItem>();
  readonly isSelected = input<boolean>(false);

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.item().metadata.matchingTransactionNames),
  );

  readonly cardClick = output<BudgetLineTableItem>();
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
}
