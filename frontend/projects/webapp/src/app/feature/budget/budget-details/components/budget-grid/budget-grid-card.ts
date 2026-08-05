import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetLine, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe, FormatConversionPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { OriginalAmountLine } from '@ui/original-amount-line';
import { SpreadBadge } from '@ui/spread-badge';
import { SavingsWithdrawalBadge } from '@ui/savings-withdrawal-badge';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { TagIndicator } from '@ui/tag-indicator';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { TagStore } from '@core/tag';
import { formatMatchAnnotation } from '../../view-models/budget-item-constants';
import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';
import { SegmentedBudgetProgress } from '../segmented-budget-progress';
import { BudgetActionMenu } from '../budget-action-menu';

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
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslocoPipe,
    AppCurrencyPipe,
    FinancialKindDirective,
    OriginalAmountLine,
    FormatConversionPipe,
    RecurrenceLabelPipe,
    SegmentedBudgetProgress,
    FinancialKindIndicator,
    BudgetActionMenu,
    SpreadBadge,
    SavingsWithdrawalBadge,
    SavingsGoalSourceLine,
    TagIndicator,
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
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <div class="flex items-center gap-2.5 min-w-0">
            <pulpe-financial-kind-indicator [kind]="item().data.kind" />
            <span
              class="text-title-medium font-medium truncate ph-no-capture"
              [class.line-through]="item().data.checkedAt"
              [class.text-on-surface-variant]="item().data.checkedAt"
            >
              {{ item().metadata.displayName }}
            </span>
            @if (item().metadata.isSpread) {
              <pulpe-spread-badge />
            }
            @if (item().metadata.isSavingsWithdrawalIncome) {
              <pulpe-savings-withdrawal-badge />
            }
            <pulpe-tag-indicator [tagNames]="tagNames()" class="shrink-0" />
          </div>
          @if (item().metadata.savingsWithdrawalOriginLabel; as originLabel) {
            <div
              class="flex items-center gap-1 min-w-0 text-on-surface-variant"
            >
              <mat-icon
                class="text-sm! shrink-0 h-auto! w-auto!"
                aria-hidden="true"
                >savings</mat-icon
              >
              <span class="text-label-small truncate">{{
                'budget.savingsWithdrawal.originSubtitle'
                  | transloco: { month: originLabel }
              }}</span>
            </div>
          }
          @if (linkedGoalName()) {
            <div
              class="flex items-center gap-1 min-w-0 text-on-surface-variant"
              [attr.data-testid]="'envelope-linked-goal-' + item().data.id"
            >
              <mat-icon
                class="text-sm! shrink-0 h-auto! w-auto!"
                aria-hidden="true"
                >savings</mat-icon
              >
              <span class="text-label-small truncate ph-no-capture">{{
                linkedGoalName()
              }}</span>
            </div>
          }
          @if (item().data.sourceSavingsGoalName; as sourceName) {
            <pulpe-savings-goal-source-line
              class="text-label-small max-w-full"
              [goalId]="item().data.sourceSavingsGoalId"
              [goalName]="sourceName"
              [attr.data-testid]="'envelope-source-goal-' + item().data.id"
            />
          }
        </div>

        <pulpe-budget-action-menu
          [item]="item()"
          [currency]="currency()"
          buttonClass="!-mr-2 !-mt-1"
          (edit)="edit.emit($event)"
          (delete)="delete.emit($event)"
          (addTransaction)="addTransaction.emit($event)"
          (spread)="spread.emit($event)"
          (resetFromTemplate)="resetFromTemplate.emit($event)"
          (postpone)="postpone.emit($event)"
        />
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
            {{ remaining | appCurrency: currency() : '1.0-0' }}
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
          [tooltipText]="item().data | formatConversion"
        />
      </div>

      <!-- Segmented Progress -->
      @if (item().consumption?.hasTransactions) {
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
                item().consumption!.consumed | appCurrency: currency() : '1.0-0'
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
      <div
        class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
      >
        <mat-chip class="!h-6 !text-label-small bg-surface-container">
          {{ item().data.recurrence | recurrenceLabel }}
        </mat-chip>

        <!--
          Un retrait annoncé ne se pointe pas : il se réalise en saisissant le
          revenu réel. Même sortie que la bascule — le conteneur tranche.
        -->
        @if (item().metadata.sourceWithdrawalCtaKey; as ctaKey) {
          <button
            matIconButton
            class="text-primary"
            (click)="toggleCheck.emit(item().data.id); $event.stopPropagation()"
            [matTooltip]="ctaKey | transloco: { name: item().data.name }"
            [attr.aria-label]="ctaKey | transloco: { name: item().data.name }"
            [attr.data-testid]="'realize-withdrawal-' + item().data.id"
          >
            <mat-icon>price_check</mat-icon>
          </button>
        } @else {
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
        }
      </div>
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
  /** Name of the linked savings goal, when this saving envelope targets one (PUL-12) */
  readonly linkedGoalName = input<string | undefined>(undefined);

  readonly #tagStore = inject(TagStore);

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.item().metadata.matchingTransactionNames),
  );

  readonly tagNames = computed(() =>
    this.#tagStore.resolveNames(this.item().data.tagIds),
  );

  readonly cardClick = output<BudgetLineTableItem>();
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly spread = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly postpone = output<string>();
  readonly toggleCheck = output<string>();
}
