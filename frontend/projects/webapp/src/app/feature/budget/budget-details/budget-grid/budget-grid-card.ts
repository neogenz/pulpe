import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { type BudgetLine, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe, ConversionTooltipPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { OriginalAmountLine } from '@ui/original-amount-line';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import {
  formatMatchAnnotation,
  type BudgetLineTableItem,
} from '../view-models';
import { SegmentedBudgetProgress } from '../components/segmented-budget-progress';
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
    MatIconModule,
    MatSlideToggleModule,
    TranslocoPipe,
    AppCurrencyPipe,
    FinancialKindDirective,
    OriginalAmountLine,
    ConversionTooltipPipe,
    RecurrenceLabelPipe,
    SegmentedBudgetProgress,
    FinancialKindIndicator,
    BudgetActionMenu,
  ],
  template: `
    <div
      class="bg-surface rounded-corner-large border border-outline-variant p-5 cursor-pointer
             transition-all duration-200 hover:shadow-md hover:border-outline-variant
             min-h-[188px] h-full flex flex-col"
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
          <pulpe-financial-kind-indicator [kind]="item().data.kind" />
          <span
            class="text-title-medium font-medium truncate ph-no-capture"
            [class.line-through]="item().data.checkedAt"
            [class.text-on-surface-variant]="item().data.checkedAt"
          >
            {{ item().metadata.displayName }}
          </span>
        </div>

        @if (!item().metadata.isRollover) {
          <pulpe-budget-action-menu
            [item]="item()"
            [currency]="currency()"
            buttonClass="!-mr-2 !-mt-1"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
            (addTransaction)="addTransaction.emit($event)"
            (resetFromTemplate)="resetFromTemplate.emit($event)"
          />
        }
      </div>

      @if (matchAnnotation()) {
        <div
          class="-mt-2 mb-3 mx-auto flex items-center gap-1.5 text-body-small
                 bg-tertiary-container/50 text-on-tertiary-container
                 rounded-full px-2.5 py-1 w-fit max-w-full"
        >
          <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">search</mat-icon>
          <span class="truncate">{{ matchAnnotation() }}</span>
        </div>
      }

      <!-- Hero Amount -->
      <div class="text-center mb-4 flex-1 flex flex-col justify-center">
        @if (item().consumption?.hasTransactions) {
          @let remaining = item().data.amount - item().consumption!.consumed;
          <div
            class="ph-no-capture text-headline-large font-bold"
            [class.text-on-surface-variant]="
              item().consumption!.consumptionState === 'healthy'
            "
            [class.text-financial-warning]="
              item().consumption!.consumptionState === 'near-limit'
            "
            [class.text-financial-over-budget]="
              item().consumption!.consumptionState === 'over-budget'
            "
          >
            {{ remaining | appCurrency: currency() : '1.2-2' }}
          </div>
          <span class="text-label-medium text-on-surface-variant">{{
            'budgetLine.available' | transloco
          }}</span>
        } @else {
          <div
            class="ph-no-capture text-headline-large font-bold"
            [pulpeFinancialKind]="item().data.kind"
          >
            {{ item().data.amount | appCurrency: currency() : '1.2-2' }}
          </div>
          <span class="text-label-medium text-on-surface-variant">{{
            'budgetLine.planned' | transloco
          }}</span>
        }
        <pulpe-original-amount-line
          [originalAmount]="item().data.originalAmount"
          [originalCurrency]="item().data.originalCurrency"
          [displayCurrency]="currency()"
          [tooltipText]="
            isMultiCurrencyEnabled() ? (item().data | conversionTooltip) : ''
          "
        />
      </div>

      <!-- Segmented Progress -->
      @if (item().consumption?.hasTransactions && !item().metadata.isRollover) {
        <div class="mb-4">
          <pulpe-segmented-budget-progress
            [percentage]="item().consumption!.percentage"
            [segmentCount]="10"
            [height]="8"
            [consumptionState]="item().consumption!.consumptionState"
          />
          <div class="flex justify-between items-center mt-2">
            <span class="ph-no-capture text-body-small text-on-surface-variant">
              {{
                item().consumption!.consumed | appCurrency: currency() : '1.2-2'
              }}
              {{ 'budgetLine.spent' | transloco }}
            </span>
            <span class="text-body-small font-medium">
              @if (item().consumption!.consumptionState === 'over-budget') {
                <span class="text-financial-over-budget">{{
                  'budgetLine.exceeded' | transloco
                }}</span>
              } @else if (
                item().consumption!.consumptionState === 'near-limit'
              ) {
                <span class="text-financial-warning"
                  >{{ item().consumption!.percentage }}%</span
                >
              } @else {
                <span class="text-on-surface-variant"
                  >{{ item().consumption!.percentage }}%</span
                >
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
            [attr.aria-label]="
              item().data.checkedAt
                ? ('budgetLine.uncheckLabel'
                  | transloco: { name: item().data.name })
                : ('budgetLine.checkLabel'
                  | transloco: { name: item().data.name })
            "
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
  readonly currency = input<SupportedCurrency>('CHF');
  readonly isSelected = input<boolean>(false);
  readonly isMultiCurrencyEnabled = input<boolean>(false);

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
