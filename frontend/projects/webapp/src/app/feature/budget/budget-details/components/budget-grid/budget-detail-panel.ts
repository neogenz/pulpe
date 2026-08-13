import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ROUTES } from '@core/routing';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import {
  AppCurrencyPipe,
  CURRENCY_CONFIG,
  FormatConversionPipe,
} from '@core/currency';
import { TagStore } from '@core/tag';
import { UserSettingsStore } from '@core/user-settings';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { TranslocoPipe } from '@jsverse/transloco';
import { OriginalAmountLine } from '@ui/original-amount-line';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { SpreadOccurrencesList } from '@ui/spread-occurrences-list';
import { TagIndicator } from '@ui/tag-indicator';
import { CheckRewardDirective } from '@ui/check-reward';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { createBudgetLineTableItem } from '../../view-models/budget-item-data-builder';
import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';
import { SegmentedBudgetProgress } from '../segmented-budget-progress';
import { BudgetDetailsStore } from '../../store/budget-details-store';
import {
  isPostponeUnavailableForRecurringLine,
  isSpreadUnavailableForRecurringLine,
} from '../budget-line-action-list';

export interface BudgetDetailPanelData {
  item: BudgetLineTableItem;
  onAddTransaction: (budgetLine: BudgetLine) => void;
  onEditBudgetLine: (item: BudgetLineTableItem) => void;
  onDeleteBudgetLine: (id: string) => void;
  onSpreadBudgetLine: (item: BudgetLineTableItem) => void;
  onResetBudgetLine: (item: BudgetLineTableItem) => void;
  onPostponeBudgetLine: (id: string) => void;
  onToggleBudgetLineCheck: (id: string) => void;
  onRealizeWithdrawal: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleTransactionCheck: (id: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
}

const DETAIL_SEGMENT_COUNT = 12;

/**
 * Responsive dialog showing forecast details and allocated transactions.
 * It is a side sheet on desktop and a full-screen dialog on mobile.
 *
 * Visual structure:
 * ┌────────────────────────────────────┐
 * │ ● Courses              [X]         │
 * │   Dépense                          │
 * ├────────────────────────────────────┤
 * │ Prévu      Dépensé      Reste      │
 * │ CHF 500    CHF 400      CHF 100    │
 * │ ████████████░░░░ 80%               │
 * ├────────────────────────────────────┤
 * │ Transactions (3)        [+ Ajouter]│
 * │ ┌────────────────────────────────┐ │
 * │ │ Migros         CHF 120   ○──── │ │
 * │ └────────────────────────────────┘ │
 * └────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-detail-panel',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    AppCurrencyPipe,
    FormatConversionPipe,
    TranslocoPipe,
    DatePipe,
    OriginalAmountLine,
    FinancialKindDirective,
    TransactionLabelPipe,
    SegmentedBudgetProgress,
    FinancialKindIndicator,
    SpreadOccurrencesList,
    TagIndicator,
    SavingsGoalSourceLine,
    CheckRewardDirective,
  ],
  template: `
    @let envelope = envelopeItem();
    <div class="budget-detail-shell h-full flex flex-col bg-surface">
      <!-- Header -->
      <div class="p-4 border-b border-outline-variant sm:p-5">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <pulpe-financial-kind-indicator [kind]="envelope.data.kind" />
            <div class="min-w-0">
              <h2
                id="budget-detail-title"
                class="text-title-large font-semibold truncate ph-no-capture"
              >
                {{ envelope.data.name }}
              </h2>
              <div class="mt-0.5 flex items-center gap-2">
                <span class="text-label-medium text-on-surface-variant">
                  {{ envelope.data.kind | transactionLabel }}
                </span>
                <pulpe-tag-indicator
                  [tagNames]="tagNamesFor(envelope.data.tagIds)"
                  data-testid="detail-forecast-tags"
                />
              </div>
              @if (linkedGoal(); as goal) {
                <div class="mt-1">
                  <button
                    matButton
                    class="self-start !-ml-2 max-w-full"
                    (click)="openLinkedGoal(goal.id)"
                    data-testid="budget-detail-panel-linked-goal"
                    [attr.aria-label]="
                      'budgetLine.linkedGoalAriaLabel' | transloco
                    "
                  >
                    <mat-icon>savings</mat-icon>
                    <span class="min-w-0 truncate">
                      {{ 'budgetLine.linkedGoal' | transloco }} :
                      <span class="ph-no-capture">{{ goal.name }}</span>
                    </span>
                  </button>
                </div>
              }
              @if (envelope.data.sourceSavingsGoalName; as sourceName) {
                <div class="mt-1">
                  <pulpe-savings-goal-source-line
                    class="text-label-small max-w-full"
                    [goalId]="envelope.data.sourceSavingsGoalId"
                    [goalName]="sourceName"
                    [attr.data-testid]="
                      'detail-panel-source-goal-' + envelope.data.id
                    "
                  />
                </div>
              }
            </div>
          </div>
          <button
            matIconButton
            (click)="close()"
            [matTooltip]="'common.close' | transloco"
            [attr.aria-label]="'budgetLine.closePanelAriaLabel' | transloco"
            class="shrink-0"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div
          class="detail-forecast-toolbar mt-3"
          data-testid="detail-forecast-toolbar"
        >
          @if (envelope.metadata.sourceWithdrawalCtaKey; as ctaKey) {
            <button
              matButton="filled"
              class="w-full min-w-0 sm:w-auto"
              (click)="onRealizeWithdrawal()"
              [attr.data-testid]="
                'detail-realize-withdrawal-' + envelope.data.id
              "
            >
              <mat-icon>add</mat-icon>
              <span class="truncate">{{ ctaKey | transloco }}</span>
            </button>
          } @else if (!envelope.data.sourceSavingsGoalId) {
            <mat-slide-toggle
              class="detail-pointing-toggle"
              labelPosition="before"
              [checked]="!!envelope.data.checkedAt"
              [pulpeCheckReward]="!!envelope.data.checkedAt"
              (change)="onToggleBudgetLineCheck()"
              [attr.data-testid]="'detail-toggle-check-' + envelope.data.id"
              [attr.aria-label]="
                envelope.data.checkedAt
                  ? ('budgetLine.uncheckLabel'
                    | transloco: { name: envelope.data.name })
                  : ('budgetLine.checkLabel'
                    | transloco: { name: envelope.data.name })
              "
            >
              <span class="text-label-large font-medium">
                {{
                  (envelope.data.checkedAt
                    ? 'budgetLine.checkedStatus'
                    : 'budgetLine.uncheckedStatus'
                  ) | transloco
                }}
              </span>
            </mat-slide-toggle>
          }

          <div class="detail-forecast-actions">
            <button
              matButton
              (click)="onEditBudgetLine(envelope)"
              [attr.data-testid]="'edit-' + envelope.data.id"
            >
              <mat-icon>edit</mat-icon>
              {{ 'budget.modify' | transloco }}
            </button>

            <button
              matIconButton
              class="shrink-0 text-financial-critical"
              (click)="onDeleteBudgetLine(envelope.data.id)"
              [matTooltip]="'common.delete' | transloco"
              [attr.aria-label]="
                'budgetLine.deleteAriaLabel'
                  | transloco: { name: envelope.data.name }
              "
              [attr.data-testid]="'delete-' + envelope.data.id"
            >
              <mat-icon class="text-financial-critical">delete</mat-icon>
            </button>

            @if (hasMoreBudgetLineActions()) {
              <button
                matIconButton
                class="shrink-0"
                [matMenuTriggerFor]="forecastMoreMenu"
                [attr.aria-label]="'common.more' | transloco"
                [attr.data-testid]="'detail-more-actions-' + envelope.data.id"
              >
                <mat-icon>more_horiz</mat-icon>
              </button>
              <mat-menu #forecastMoreMenu="matMenu" xPosition="before">
                @if (envelope.metadata.canSpread) {
                  <button mat-menu-item (click)="onSpreadBudgetLine(envelope)">
                    <mat-icon matMenuItemIcon>calendar_month</mat-icon>
                    <span>{{
                      'budgetLine.spread.spreadAction' | transloco
                    }}</span>
                  </button>
                } @else if (showSpreadUnavailable()) {
                  <span
                    class="block"
                    [matTooltip]="
                      'budgetLine.spread.spreadUnavailableRecurrent' | transloco
                    "
                    matTooltipPosition="above"
                  >
                    <button mat-menu-item disabled>
                      <mat-icon matMenuItemIcon>calendar_month</mat-icon>
                      <span>{{
                        'budgetLine.spread.spreadAction' | transloco
                      }}</span>
                    </button>
                  </span>
                }
                @if (envelope.metadata.canResetFromTemplate) {
                  <button mat-menu-item (click)="onResetBudgetLine(envelope)">
                    <mat-icon matMenuItemIcon>refresh</mat-icon>
                    <span>{{ 'budget.reset' | transloco }}</span>
                  </button>
                }
                @if (envelope.metadata.showPostpone) {
                  <span
                    class="block w-full"
                    [matTooltip]="
                      envelope.metadata.postponeDisabledReason
                        ? (envelope.metadata.postponeDisabledReason
                          | transloco
                            : {
                                month: envelope.metadata.postponeTargetLabel,
                              })
                        : ''
                    "
                  >
                    <button
                      mat-menu-item
                      [disabled]="envelope.metadata.isPostponeDisabled"
                      (click)="onPostponeBudgetLine(envelope.data.id)"
                    >
                      <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
                      <span>{{ 'budget.postpone' | transloco }}</span>
                    </button>
                  </span>
                } @else if (showPostponeUnavailable()) {
                  <span
                    class="block w-full"
                    [matTooltip]="
                      'budget.postponeUnavailableRecurrent' | transloco
                    "
                    matTooltipPosition="above"
                  >
                    <button mat-menu-item disabled>
                      <mat-icon matMenuItemIcon>event_upcoming</mat-icon>
                      <span>{{ 'budget.postpone' | transloco }}</span>
                    </button>
                  </span>
                }
              </mat-menu>
            }
          </div>
        </div>
      </div>

      <!-- Financial Summary -->
      <div class="p-5 border-b border-outline-variant">
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">
              {{ 'budget.tablePlanned' | transloco }}
            </div>
            <div
              class="ph-no-capture text-title-medium font-bold"
              [pulpeFinancialKind]="envelope.data.kind"
            >
              {{ envelope.data.amount | appCurrency: currency() : '1.2-2' }}
            </div>
            <pulpe-original-amount-line
              [originalAmount]="envelope.data.originalAmount"
              [originalCurrency]="envelope.data.originalCurrency"
              [displayCurrency]="currency()"
              [tooltipText]="envelope.data | formatConversion"
            />
          </div>
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">
              {{ 'budget.consumedLabel' | transloco }}
            </div>
            <div class="ph-no-capture text-title-medium font-semibold">
              {{
                envelope.consumption?.consumed ?? 0
                  | appCurrency: currency() : '1.0-0'
              }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">
              {{ 'budget.availableLabel' | transloco }}
            </div>
            @let remaining =
              envelope.data.amount - (envelope.consumption?.consumed ?? 0);
            <div
              class="ph-no-capture text-title-medium font-semibold"
              [class.text-on-surface-variant]="
                envelope.consumption?.consumptionState === 'healthy'
              "
              [class.text-financial-warning]="
                envelope.consumption?.consumptionState === 'near-limit'
              "
              [class.text-financial-over-budget]="
                envelope.consumption?.consumptionState === 'over-budget'
              "
            >
              {{ remaining | appCurrency: currency() : '1.0-0' }}
            </div>
          </div>
        </div>

        <!-- Progress Bar (12 segments for more detail) -->
        @let consumption = envelope.consumption;
        @if (consumption && consumption.hasTransactions) {
          <pulpe-segmented-budget-progress
            [percentage]="consumption.percentage"
            [segmentCount]="detailSegmentCount"
            [height]="10"
            [consumptionState]="consumption.consumptionState"
            class="mb-2"
          />
          <div class="text-center text-label-medium">
            @if (consumption.consumptionState === 'over-budget') {
              <span class="ph-no-capture text-financial-over-budget">
                {{
                  'budgetLine.exceededBy'
                    | transloco
                      : {
                          amount:
                            (consumption.consumed - envelope.data.amount
                            | appCurrency: currency() : '1.0-0'),
                        }
                }}
              </span>
            } @else if (consumption.consumptionState === 'near-limit') {
              <span class="text-financial-warning">{{
                'budgetLine.usedPercent'
                  | transloco: { percent: consumption.percentage }
              }}</span>
            } @else {
              <span class="text-on-surface-variant">{{
                'budgetLine.usedPercent'
                  | transloco: { percent: consumption.percentage }
              }}</span>
            }
          </div>
        }
      </div>

      <!-- Transactions Section -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-5">
          <div
            class="flex items-center justify-between mb-4"
            data-testid="detail-movements-header"
          >
            <h3 class="text-title-medium font-semibold">
              {{ 'budget.transactions' | transloco }}
              @if (allocatedTransactions().length > 0) {
                <span class="text-on-surface-variant font-normal">
                  ({{ allocatedTransactions().length }})
                </span>
              }
            </h3>
            @if (!envelope.data.sourceSavingsGoalId) {
              <button
                matButton
                (click)="onAddTransaction()"
                class="!rounded-full"
                [attr.aria-label]="
                  'budgetLine.addTransactionAriaLabel' | transloco
                "
              >
                <mat-icon>add</mat-icon>
                {{ 'common.add' | transloco }}
              </button>
            }
          </div>

          @if (allocatedTransactions().length === 0) {
            <div class="text-center py-8 text-on-surface-variant">
              <mat-icon class="mb-2 opacity-50">receipt_long</mat-icon>
              <p class="text-body-medium">
                {{ 'budget.noTransaction' | transloco }}
              </p>
              <p class="text-body-small">
                {{ 'budgetLine.noTransactionHint' | transloco }}
              </p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (tx of allocatedTransactions(); track tx.id) {
                <div
                  class="bg-surface-container-low rounded-xl p-4 flex items-center gap-3"
                  [attr.data-testid]="'detail-transaction-' + tx.id"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class="flex-1 min-w-0 text-body-medium font-medium truncate ph-no-capture"
                        [class.line-through]="tx.checkedAt"
                        [class.text-on-surface-variant]="tx.checkedAt"
                      >
                        {{ tx.name }}
                      </span>
                      <pulpe-tag-indicator
                        [tagNames]="tagNamesFor(tx.tagIds)"
                        class="shrink-0"
                      />
                    </div>
                    <div class="text-label-small text-on-surface-variant">
                      {{ tx.transactionDate | date: shortDateFormat() }}
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div
                      class="ph-no-capture text-title-medium font-bold"
                      [class.text-financial-income]="tx.kind === 'income'"
                      [class.text-on-surface-variant]="tx.kind !== 'income'"
                    >
                      {{ tx.amount | appCurrency: currency() : '1.2-2' }}
                    </div>
                    <pulpe-original-amount-line
                      [originalAmount]="tx.originalAmount"
                      [originalCurrency]="tx.originalCurrency"
                      [displayCurrency]="currency()"
                      [tooltipText]="tx | formatConversion"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <mat-slide-toggle
                      [checked]="!!tx.checkedAt"
                      [pulpeCheckReward]="!!tx.checkedAt"
                      (change)="onToggleCheck(tx.id)"
                      (click)="$event.stopPropagation()"
                      [attr.data-testid]="'toggle-tx-check-' + tx.id"
                      [attr.aria-label]="
                        tx.checkedAt
                          ? ('budgetLine.uncheckLabel'
                            | transloco: { name: tx.name })
                          : ('budgetLine.checkLabel'
                            | transloco: { name: tx.name })
                      "
                    />
                    <button
                      matIconButton
                      (click)="onEditTransaction(tx)"
                      [matTooltip]="'common.edit' | transloco"
                      [attr.data-testid]="'edit-tx-' + tx.id"
                      [attr.aria-label]="
                        'budgetLine.editAriaLabel'
                          | transloco: { name: tx.name }
                      "
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      matIconButton
                      (click)="onDeleteTransaction(tx.id)"
                      [matTooltip]="'common.delete' | transloco"
                      [attr.data-testid]="'delete-tx-' + tx.id"
                      [attr.aria-label]="
                        'budgetLine.deleteAriaLabel'
                          | transloco: { name: tx.name }
                      "
                    >
                      <mat-icon class="text-error">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- PUL-17 — spread occurrences as its own section: full-width
             separator + matching p-5 padding so it reads as a distinct block,
             not glued to the Transactions list. -->
        @if (envelope.data.spreadGroupId) {
          <div class="p-5 border-t border-outline-variant">
            <div class="flex items-center gap-2 mb-4">
              <mat-icon class="text-primary shrink-0">timelapse</mat-icon>
              <h3 class="text-title-medium font-semibold">
                {{
                  'budgetLine.spread.sectionTitle'
                    | transloco: { count: spreadOccurrences().length }
                }}
              </h3>
            </div>
            @if (isSpreadLoading()) {
              <div class="flex justify-center py-4">
                <mat-spinner diameter="28" />
              </div>
            } @else if (spreadError()) {
              <p class="text-body-small text-on-surface-variant">
                {{ 'budgetLine.spread.loadError' | transloco }}
              </p>
            } @else {
              <pulpe-spread-occurrences-list
                [occurrences]="spreadOccurrences()"
                [tracker]="spreadTracker()"
                [currency]="currency()"
                [locale]="locale()"
                [isCurrentPeriod]="isCurrentPeriod()"
                density="compact"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .detail-forecast-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
    }

    .detail-pointing-toggle {
      justify-self: start;
    }

    .detail-forecast-actions {
      display: flex;
      grid-column: 2;
      align-items: center;
      gap: 0.25rem;
      justify-self: end;
    }

    @media (max-width: 359px) {
      .detail-forecast-toolbar {
        grid-template-columns: minmax(0, 1fr);
      }

      .detail-forecast-actions {
        grid-column: 1;
        justify-self: start;
      }
    }

    @media (max-width: 639px) {
      .budget-detail-shell {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetDetailPanel {
  readonly #dialogRef = inject(MatDialogRef<BudgetDetailPanel>);
  readonly #router = inject(Router);
  readonly #store = inject(BudgetDetailsStore);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #tagStore = inject(TagStore);
  protected readonly currency = this.#userSettings.currency;
  // Date locale (fr-CH / fr-FR) for month names — NOT numberLocale (de-CH),
  // which would render the spread months in German ("Juni" instead of "juin").
  protected readonly locale = computed(
    () => CURRENCY_CONFIG[this.currency()].locale,
  );
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );
  protected readonly data = inject<BudgetDetailPanelData>(MAT_DIALOG_DATA);

  readonly detailSegmentCount = DETAIL_SEGMENT_COUNT;

  constructor() {
    // PUL-17 — load this line's spread group so the occurrences section can
    // render its cross-month tranches; null clears it for non-spread lines.
    this.#store.setSpreadGroupId(this.data.item.data.spreadGroupId ?? null);
  }

  /**
   * Reactive envelope derived from the store.
   * Recomputes consumption when transactions are added/removed,
   * so Prévu/Dépensé/Reste update without closing the panel.
   */
  protected readonly envelopeItem = computed<BudgetLineTableItem>(() => {
    const details = this.#store.budgetDetails();
    if (!details) return this.data.item;

    const budgetLine = details.budgetLines.find(
      (line) => line.id === this.data.item.data.id,
    );
    if (!budgetLine) return this.data.item;

    return createBudgetLineTableItem({
      budgetLine,
      transactions: details.transactions ?? [],
      postpone: {
        hasNextMonthBudget: this.#store.hasNextMonthBudget(),
        nextMonthLabel: this.#store.nextMonthLabel(),
      },
      savingsWithdrawalOriginLabel: this.#store.savingsWithdrawalOriginLabel(),
    });
  });

  protected readonly showSpreadUnavailable = computed(() =>
    isSpreadUnavailableForRecurringLine(this.envelopeItem()),
  );

  protected readonly showPostponeUnavailable = computed(() =>
    isPostponeUnavailableForRecurringLine(this.envelopeItem()),
  );

  protected readonly hasMoreBudgetLineActions = computed(() => {
    const { metadata } = this.envelopeItem();
    return !!(
      metadata.canSpread ||
      metadata.canResetFromTemplate ||
      metadata.showPostpone ||
      this.showSpreadUnavailable() ||
      this.showPostponeUnavailable()
    );
  });

  /**
   * Computed signal that reactively filters transactions for the current budget line.
   * Updates automatically when the store's transactions change (e.g., after adding a transaction).
   */
  protected readonly allocatedTransactions = computed(() => {
    const details = this.#store.budgetDetails();
    if (!details) return [];
    return details.transactions.filter(
      (tx) => tx.budgetLineId === this.data.item.data.id,
    );
  });

  protected tagNamesFor(tagIds: readonly string[] | undefined): string[] {
    return this.#tagStore.resolveNames(tagIds);
  }

  // PUL-17 — spread occurrences/tracker are derived once in the store (single
  // source for every detail surface); these are thin protected aliases so the
  // template can read them while #store stays private.
  protected readonly spreadOccurrences = this.#store.spreadOccurrenceViewModels;
  protected readonly spreadTracker = this.#store.spreadTracker;
  protected readonly isCurrentPeriod = this.#store.isViewingSpreadCurrentPeriod;
  protected readonly isSpreadLoading = this.#store.isSpreadOccurrencesLoading;
  protected readonly spreadError = this.#store.spreadOccurrencesError;

  // PUL-12 — the savings goal this envelope is linked to, resolved from the
  // store's id→name map. Null (renders nothing) when unlinked or name unloaded.
  protected readonly linkedGoal = computed<{ id: string; name: string } | null>(
    () => {
      const id = this.envelopeItem().data.savingsGoalId;
      if (!id) return null;
      const name = this.#store.savingsGoalNameById().get(id);
      return name ? { id, name } : null;
    },
  );

  protected close(): void {
    this.#dialogRef.close();
  }

  protected openLinkedGoal(goalId: string): void {
    this.#dialogRef.close();
    this.#router.navigate(['/', ROUTES.SAVINGS_GOALS, goalId]);
  }

  protected onAddTransaction(
    budgetLine: BudgetLine = this.envelopeItem().data,
  ): void {
    this.#dialogRef.close();
    this.data.onAddTransaction(budgetLine);
  }

  protected onEditBudgetLine(item: BudgetLineTableItem): void {
    this.#dialogRef.close();
    this.data.onEditBudgetLine(item);
  }

  protected onDeleteBudgetLine(id: string): void {
    this.#dialogRef.close();
    this.data.onDeleteBudgetLine(id);
  }

  protected onSpreadBudgetLine(item: BudgetLineTableItem): void {
    this.#dialogRef.close();
    this.data.onSpreadBudgetLine(item);
  }

  protected onResetBudgetLine(item: BudgetLineTableItem): void {
    this.#dialogRef.close();
    this.data.onResetBudgetLine(item);
  }

  protected onPostponeBudgetLine(id: string): void {
    this.#dialogRef.close();
    this.data.onPostponeBudgetLine(id);
  }

  protected onToggleBudgetLineCheck(): void {
    this.data.onToggleBudgetLineCheck(this.envelopeItem().data.id);
  }

  protected onRealizeWithdrawal(): void {
    this.#dialogRef.close();
    this.data.onRealizeWithdrawal(this.envelopeItem().data.id);
  }

  protected onDeleteTransaction(id: string): void {
    this.data.onDeleteTransaction(id);
  }

  protected onEditTransaction(tx: Transaction): void {
    this.data.onEditTransaction(tx);
  }

  protected onToggleCheck(id: string): void {
    this.data.onToggleTransactionCheck(id);
  }
}
