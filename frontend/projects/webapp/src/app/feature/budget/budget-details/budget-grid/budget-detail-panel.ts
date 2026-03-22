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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import { AppCurrencyPipe, buildConversionTooltip } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrencyConversionBadge } from '@ui/currency-conversion-badge';
import { FinancialKindDirective } from '@ui/financial-kind';
import { TransactionLabelPipe } from '@ui/transaction-display';
import {
  createBudgetLineConsumptionDisplay,
  type BudgetLineTableItem,
} from '../data-core';
import { SegmentedBudgetProgress } from '../components/segmented-budget-progress';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { BudgetDetailsStore } from '../store/budget-details-store';

export interface BudgetDetailPanelData {
  item: BudgetLineTableItem;
  onAddTransaction: (budgetLine: BudgetLine) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleTransactionCheck: (id: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
}

const DETAIL_SEGMENT_COUNT = 12;

/**
 * Side panel showing envelope details and allocated transactions
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
    MatSlideToggleModule,
    MatTooltipModule,
    AppCurrencyPipe,
    TranslocoPipe,
    DatePipe,
    CurrencyConversionBadge,
    FinancialKindDirective,
    TransactionLabelPipe,
    TranslocoPipe,
    SegmentedBudgetProgress,
    BudgetKindIndicator,
  ],
  template: `
    @let envelope = envelopeItem();
    <div class="h-full flex flex-col bg-surface">
      <!-- Header -->
      <div class="p-5 border-b border-outline-variant">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <pulpe-budget-kind-indicator [kind]="envelope.data.kind" />
            <div class="min-w-0">
              <h2 class="text-title-large font-semibold truncate ph-no-capture">
                {{ envelope.data.name }}
              </h2>
              <span class="text-label-medium text-on-surface-variant">
                {{ envelope.data.kind | transactionLabel }}
              </span>
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
      </div>

      <!-- Financial Summary -->
      <div class="p-5 border-b border-outline-variant">
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">
              {{ 'budget.tablePlanned' | transloco }}
            </div>
            <div
              class="ph-no-capture text-title-medium font-bold flex items-center justify-center gap-1"
              [pulpeFinancialKind]="envelope.data.kind"
            >
              {{ envelope.data.amount | appCurrency: currency() : '1.0-0' }}
              <pulpe-currency-conversion-badge
                [originalAmount]="envelope.data.originalAmount"
                [originalCurrency]="envelope.data.originalCurrency"
                [exchangeRate]="envelope.data.exchangeRate"
                [tooltipText]="
                  conversionTooltip(
                    envelope.data.originalAmount,
                    envelope.data.originalCurrency,
                    envelope.data.exchangeRate
                  )
                "
              />
            </div>
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
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-title-medium font-semibold">
              {{ 'budget.transactions' | transloco }}
              @if (allocatedTransactions().length > 0) {
                <span class="text-on-surface-variant font-normal">
                  ({{ allocatedTransactions().length }})
                </span>
              }
            </h3>
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
                    <div
                      class="text-body-medium font-medium truncate ph-no-capture"
                      [class.line-through]="tx.checkedAt"
                      [class.text-on-surface-variant]="tx.checkedAt"
                    >
                      {{ tx.name }}
                    </div>
                    <div class="text-label-small text-on-surface-variant">
                      {{ tx.transactionDate | date: 'dd.MM.yyyy' }}
                    </div>
                  </div>
                  <div
                    class="ph-no-capture text-title-medium font-bold shrink-0 flex items-center gap-1"
                    [class.text-financial-income]="tx.kind === 'income'"
                    [class.text-on-surface-variant]="tx.kind !== 'income'"
                  >
                    {{ tx.amount | appCurrency: currency() : '1.0-0' }}
                    <pulpe-currency-conversion-badge
                      [originalAmount]="tx.originalAmount"
                      [originalCurrency]="tx.originalCurrency"
                      [exchangeRate]="tx.exchangeRate"
                      [tooltipText]="
                        conversionTooltip(
                          tx.originalAmount,
                          tx.originalCurrency,
                          tx.exchangeRate
                        )
                      "
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <mat-slide-toggle
                      [checked]="!!tx.checkedAt"
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
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetDetailPanel {
  readonly #dialogRef = inject(MatDialogRef<BudgetDetailPanel>);
  readonly #store = inject(BudgetDetailsStore);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #transloco = inject(TranslocoService);
  protected readonly currency = this.#userSettings.currency;
  protected readonly data = inject<BudgetDetailPanelData>(MAT_DIALOG_DATA);

  readonly detailSegmentCount = DETAIL_SEGMENT_COUNT;

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

    return {
      ...this.data.item,
      data: budgetLine,
      consumption: createBudgetLineConsumptionDisplay(
        budgetLine,
        details.transactions ?? [],
      ),
    };
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

  protected conversionTooltip(
    originalAmount: number | null | undefined,
    originalCurrency: string | null | undefined,
    exchangeRate: number | null | undefined,
  ): string {
    return buildConversionTooltip(
      this.#transloco,
      originalAmount,
      originalCurrency,
      exchangeRate,
    );
  }

  protected close(): void {
    this.#dialogRef.close();
  }

  protected onAddTransaction(): void {
    this.data.onAddTransaction(this.data.item.data);
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
