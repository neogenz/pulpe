import { CurrencyPipe, DatePipe } from '@angular/common';
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
    CurrencyPipe,
    DatePipe,
    FinancialKindDirective,
    TransactionLabelPipe,
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
              <h2 class="text-title-large font-semibold truncate">
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
            matTooltip="Fermer"
            aria-label="Fermer le panneau"
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
            <div class="text-label-medium text-on-surface-variant">Prévu</div>
            <div
              class="ph-no-capture text-title-medium font-bold"
              [pulpeFinancialKind]="envelope.data.kind"
            >
              {{ envelope.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">Dépensé</div>
            <div class="ph-no-capture text-title-medium font-semibold">
              {{
                envelope.consumption?.consumed ?? 0
                  | currency: 'CHF' : 'symbol' : '1.0-0'
              }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-medium text-on-surface-variant">Reste</div>
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
              {{ remaining | currency: 'CHF' : 'symbol' : '1.0-0' }}
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
<<<<<<< HEAD
          <div class="text-center text-label-medium">
            @if (consumption.consumptionState === 'over-budget') {
              <span class="ph-no-capture text-financial-over-budget">
                Dépassé de
                {{
                  consumption.consumed - envelope.data.amount
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </span>
            } @else if (consumption.consumptionState === 'near-limit') {
              <span class="text-financial-warning"
                >{{ consumption.percentage }}% utilisé</span
              >
            } @else {
              <span class="text-on-surface-variant"
                >{{ consumption.percentage }}% utilisé</span
              >
            }
          </div>
        }
      </div>

      <!-- Transactions Section -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-title-medium font-semibold">
              Transactions
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
              aria-label="Ajouter une transaction"
            >
              <mat-icon>add</mat-icon>
              Ajouter
            </button>
          </div>

          @if (allocatedTransactions().length === 0) {
            <div class="text-center py-8 text-on-surface-variant">
              <mat-icon class="mb-2 opacity-50">receipt_long</mat-icon>
              <p class="text-body-medium">Pas de transaction</p>
              <p class="text-body-small">
                Ajoute une transaction pour suivre tes dépenses
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
                      class="text-body-medium font-medium truncate"
                      [class.line-through]="tx.checkedAt"
                      [class.text-on-surface-variant]="tx.checkedAt"
                    >
                      {{ tx.name }}
                    </div>
                    <div class="text-label-small text-on-surface-variant">
                      {{
                        tx.transactionDate | date: 'dd.MM.yyyy' : '' : 'fr-CH'
                      }}
                    </div>
                  </div>
                  <div
                    class="ph-no-capture text-title-medium font-bold shrink-0"
                    [class.text-financial-income]="tx.kind === 'income'"
                    [class.text-on-surface-variant]="tx.kind !== 'income'"
                  >
                    {{ tx.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
                  </div>
                  <div class="flex items-center gap-1">
                    <mat-slide-toggle
                      [checked]="!!tx.checkedAt"
                      (change)="onToggleCheck(tx.id)"
                      (click)="$event.stopPropagation()"
                      [attr.data-testid]="'toggle-tx-check-' + tx.id"
                      [attr.aria-label]="
                        tx.checkedAt
                          ? 'Marquer ' + tx.name + ' comme non vérifié'
                          : 'Marquer ' + tx.name + ' comme vérifié'
                      "
                    />
                    <button
                      matIconButton
                      (click)="onEditTransaction(tx)"
                      matTooltip="Modifier"
                      [attr.data-testid]="'edit-tx-' + tx.id"
                      [attr.aria-label]="'Modifier ' + tx.name"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      matIconButton
                      (click)="onDeleteTransaction(tx.id)"
                      matTooltip="Supprimer"
                      [attr.data-testid]="'delete-tx-' + tx.id"
                      [attr.aria-label]="'Supprimer ' + tx.name"
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
