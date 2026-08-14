import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
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
import { CheckRewardDirective } from '@ui/check-reward';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { TagStore } from '@core/tag';
import {
  consumptionProgressMessage,
  formatMatchAnnotation,
} from '../../view-models/budget-item-constants';
import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';
import { SegmentedBudgetProgress } from '../segmented-budget-progress';
import { BudgetActionMenu } from '../budget-action-menu';

/**
 * Desktop forecast card.
 *
 * Reading order stays stable across every state:
 * title → available amount → progress → cadence, origin and check state.
 */
@Component({
  selector: 'pulpe-budget-grid-card',
  imports: [
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
    CheckRewardDirective,
  ],
  template: `
    @let consumed = item().consumption?.consumed ?? 0;
    @let remaining = item().data.amount - consumed;
    @let percentage = item().consumption?.percentage ?? 0;
    @let progressMessage =
      consumptionProgressMessage(item().data.amount, consumed, percentage);

    <div
      class="budget-grid-card rounded-corner-large border border-outline-variant
             cursor-pointer h-full"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      role="button"
      tabindex="0"
      (click)="cardClick.emit(item())"
      (keydown.enter)="cardClick.emit(item())"
      (keydown.space)="cardClick.emit(item()); $event.preventDefault()"
      [attr.data-testid]="'envelope-card-' + item().data.id"
    >
      <div class="flex items-start justify-between gap-3 min-w-0">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2.5 min-w-0">
            <pulpe-financial-kind-indicator [kind]="item().data.kind" />
            <span class="text-title-small font-semibold truncate ph-no-capture">
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

          <div
            class="h-4 mt-0.5 text-label-small text-on-surface-variant truncate"
          >
            @if (matchAnnotation()) {
              <span class="inline-flex items-center gap-1 max-w-full">
                <mat-icon class="text-sm! h-auto! w-auto!" aria-hidden="true"
                  >search</mat-icon
                >
                <span class="truncate">{{ matchAnnotation() }}</span>
              </span>
            } @else if (
              item().metadata.savingsWithdrawalOriginLabel;
              as originLabel
            ) {
              <span class="inline-flex items-center gap-1 max-w-full">
                <mat-icon class="text-sm! h-auto! w-auto!" aria-hidden="true"
                  >savings</mat-icon
                >
                <span class="truncate">{{
                  'budget.savingsWithdrawal.originSubtitle'
                    | transloco: { month: originLabel }
                }}</span>
              </span>
            } @else if (item().data.sourceSavingsGoalName; as sourceName) {
              <pulpe-savings-goal-source-line
                class="max-w-full"
                [goalId]="item().data.sourceSavingsGoalId"
                [goalName]="sourceName"
                [attr.data-testid]="'envelope-source-goal-' + item().data.id"
              />
            } @else if (linkedGoalName()) {
              <span
                class="ph-no-capture"
                [attr.data-testid]="'envelope-linked-goal-' + item().data.id"
              >
                {{ linkedGoalName() }}
              </span>
            }
          </div>
        </div>

        <pulpe-budget-action-menu
          [item]="item()"
          [currency]="currency()"
          (edit)="edit.emit($event)"
          (delete)="delete.emit($event)"
          (addTransaction)="addTransaction.emit($event)"
          (spread)="spread.emit($event)"
          (resetFromTemplate)="resetFromTemplate.emit($event)"
          (postpone)="postpone.emit($event)"
        />
      </div>

      <div class="flex flex-col justify-center min-w-0 mt-3">
        <p class="text-label-small text-on-surface-variant">
          {{ 'budgetLine.available.' + item().data.kind | transloco }}
        </p>
        <p
          class="ph-no-capture text-headline-large font-semibold tabular-nums
                 truncate leading-tight"
          [pulpeFinancialKind]="item().data.kind"
        >
          {{ remaining | appCurrency: currency() : '1.0-0' }}
        </p>
        <pulpe-original-amount-line
          [originalAmount]="item().data.originalAmount"
          [originalCurrency]="item().data.originalCurrency"
          [displayCurrency]="currency()"
          [tooltipText]="item().data | formatConversion"
        />
      </div>

      <div class="flex flex-col justify-center min-w-0 mt-2">
        <pulpe-segmented-budget-progress
          [percentage]="percentage"
          [segmentCount]="10"
          [height]="6"
          [consumptionState]="item().consumption?.consumptionState ?? 'healthy'"
        />
        <p
          class="mt-1 ph-no-capture text-label-small text-on-surface-variant
                 truncate"
        >
          {{ consumed | appCurrency: currency() : '1.0-0' }}
          {{ 'budgetLine.spent.' + item().data.kind | transloco }}
          ·
          @if (progressMessage.key === 'budgetLine.exceededBy') {
            {{
              progressMessage.key
                | transloco
                  : {
                      amount:
                        (progressMessage.params.amount
                        | appCurrency: currency() : '1.0-0'),
                    }
            }}
          } @else {
            {{ progressMessage.key | transloco: progressMessage.params }}
          }
        </p>
      </div>

      <div
        class="flex items-center justify-between gap-3 min-w-0 mt-3 pt-3
               border-t border-outline-variant/40"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <mat-chip
            class="!h-6 !text-label-small bg-surface-container shrink-0"
            [matTooltip]="
              item().data.recurrence === 'fixed'
                ? ('recurrence.fixedHint' | transloco)
                : ('recurrence.oneOffHint' | transloco)
            "
          >
            {{ item().data.recurrence | recurrenceLabel }}
          </mat-chip>
          <span class="text-label-small text-on-surface-variant truncate">
            {{
              (item().metadata.isTemplateLinked
                ? 'recurrence.fromTemplate'
                : 'recurrence.fromBudget'
              ) | transloco
            }}
          </span>
        </div>

        @if (item().metadata.sourceWithdrawalCtaKey; as ctaKey) {
          <button
            matButton
            class="text-primary shrink-0"
            (click)="
              realizeWithdrawal.emit(item().data.id); $event.stopPropagation()
            "
            [attr.data-testid]="'realize-withdrawal-' + item().data.id"
          >
            {{ ctaKey | transloco }}
          </button>
        } @else if (item().metadata.isSourceWithdrawalRealized) {
          <span class="text-label-medium text-on-surface-variant shrink-0">
            {{ 'budgetLine.withdrawalRealized' | transloco }}
          </span>
        } @else {
          <mat-slide-toggle
            class="shrink-0"
            [checked]="!!item().data.checkedAt"
            [pulpeCheckReward]="!!item().data.checkedAt"
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
          >
            {{
              (item().data.checkedAt
                ? 'budgetLine.checkedStatus'
                : 'budgetLine.uncheckedStatus'
              ) | transloco
            }}
          </mat-slide-toggle>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .budget-grid-card {
      min-height: 220px;
      display: grid;
      grid-template-rows: auto minmax(58px, 1fr) auto auto;
      padding: 16px;
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-container-low) 12%,
        var(--mat-sys-surface)
      );
      transition:
        background-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        border-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        transform var(--pulpe-motion-fast) var(--pulpe-ease-standard);

      &:hover {
        background: var(--mat-sys-surface-container-low);
        border-color: var(--mat-sys-outline);
        transform: translateY(-1px);
      }

      &:focus-visible {
        outline: 3px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .budget-grid-card {
        transition: none;

        &:hover {
          transform: none;
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetGridCard {
  protected readonly consumptionProgressMessage = consumptionProgressMessage;
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
  readonly realizeWithdrawal = output<string>();
}
