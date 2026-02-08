import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  ViewContainerRef,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { TransactionViewModel } from '../models/transaction-view-model';
import type { BudgetLineTableItem } from '../data-core';
import {
  BudgetDetailPanel,
  type BudgetDetailPanelData,
} from './budget-detail-panel';
import { BudgetListRow } from './budget-list-row';

/**
 * List view component displaying budget lines as compact rows.
 * Groups by category (income/saving/expense) with collapsible sections.
 */
@Component({
  selector: 'pulpe-budget-grid',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatRippleModule,
    MatSlideToggleModule,
    CurrencyPipe,
    BudgetListRow,
  ],
  template: `
    @if (budgetLineItems().length === 0) {
      <ng-container *ngTemplateOutlet="emptyState" />
    } @else {
      <!-- Compact list grouped by category -->
      <div class="rounded-xl border border-outline-variant overflow-hidden">
        @for (
          category of categories();
          track category.title;
          let isLast = $last
        ) {
          @if (category.items.length > 0) {
            <mat-expansion-panel
              [expanded]="true"
              class="!shadow-none !rounded-none"
              [class.border-b]="!isLast"
              [class.border-outline-variant]="!isLast"
            >
              <mat-expansion-panel-header class="!h-10 !px-3">
                <mat-panel-title>
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-base! text-on-surface-variant">
                      {{ category.icon }}
                    </mat-icon>
                    <span class="text-body-medium font-medium">
                      {{ category.title }}
                    </span>
                    <span class="text-label-small text-on-surface-variant">
                      ({{ category.items.length }})
                    </span>
                    <span
                      class="text-label-small font-medium ml-auto mr-4"
                      [class.text-pulpe-financial-income]="
                        category.kind === 'income'
                      "
                      [class.text-pulpe-financial-savings]="
                        category.kind === 'saving'
                      "
                      [class.text-pulpe-financial-expense]="
                        category.kind === 'expense'
                      "
                    >
                      {{
                        category.total | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  </div>
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="bg-surface">
                @for (
                  item of category.items;
                  track item.data.id;
                  let idx = $index
                ) {
                  <pulpe-budget-list-row
                    [item]="item"
                    [isEven]="idx % 2 === 0"
                    (rowClick)="openDetailPanel($event)"
                    (edit)="edit.emit($event)"
                    (delete)="delete.emit($event)"
                    (addTransaction)="addTransaction.emit($event)"
                    (viewTransactions)="viewTransactions.emit($event)"
                    (resetFromTemplate)="resetFromTemplate.emit($event)"
                    (toggleCheck)="toggleCheck.emit($event)"
                  />
                }
              </div>
            </mat-expansion-panel>
          }
        }
      </div>

      <!-- Free transactions section -->
      @if (transactionItems().length > 0) {
        <div
          class="mt-4 rounded-xl border border-outline-variant overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-3 py-2 bg-surface-container-low"
          >
            <mat-icon class="text-base! text-on-surface-variant">
              receipt
            </mat-icon>
            <span class="text-body-medium font-medium">Transactions</span>
            <span class="text-label-small text-on-surface-variant">
              ({{ transactionItems().length }})
            </span>
          </div>
          @for (
            item of transactionItems();
            track item.data.id;
            let idx = $index
          ) {
            <ng-container
              *ngTemplateOutlet="
                transactionRow;
                context: { $implicit: item, idx: idx }
              "
            />
          }
        </div>
      }
    }

    <!-- Empty State Template -->
    <ng-template #emptyState>
      <div class="text-center py-12 px-4">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
        >
          <mat-icon class="text-primary text-3xl! shrink-0">
            account_balance_wallet
          </mat-icon>
        </div>
        <p class="text-body-large text-on-surface mb-2">
          Pas encore d'enveloppe
        </p>
        <p class="text-body-medium text-on-surface-variant mb-6">
          Crée ta première enveloppe pour commencer à voir clair
        </p>
        <button
          matButton="filled"
          (click)="add.emit()"
          class="px-6"
          data-testid="add-first-line"
        >
          <mat-icon>add</mat-icon>
          Créer une enveloppe
        </button>
      </div>
    </ng-template>

    <!-- Transaction Row Template -->
    <ng-template #transactionRow let-item let-idx="idx">
      <div
        matRipple
        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low transition-colors border-b border-outline-variant/30 last:border-b-0"
        [class.bg-surface-container-lowest]="idx % 2 === 0"
        [class.opacity-50]="item.metadata.isLoading"
        [attr.data-testid]="'transaction-row-' + item.data.id"
      >
        <!-- Envelope indicator -->
        @if (item.metadata.envelopeName) {
          <mat-icon class="text-sm! text-on-surface-variant shrink-0">
            subdirectory_arrow_right
          </mat-icon>
        }

        <!-- Name -->
        <span class="flex-1 text-body-medium truncate">
          {{ item.data.name }}
        </span>

        <!-- Envelope name badge -->
        @if (item.metadata.envelopeName) {
          <span
            class="text-label-small text-on-surface-variant px-2 py-0.5 bg-surface-container rounded hidden sm:block"
          >
            {{ item.metadata.envelopeName }}
          </span>
        }

        <!-- Amount -->
        <span
          class="text-body-medium font-semibold tabular-nums w-20 text-right shrink-0"
          [class.text-pulpe-financial-income]="item.data.kind === 'income'"
          [class.text-pulpe-financial-expense]="item.data.kind === 'expense'"
          [class.text-pulpe-financial-savings]="item.data.kind === 'saving'"
        >
          {{ item.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
        </span>

        <!-- Actions -->
        <div class="flex items-center gap-0.5 shrink-0">
          <mat-slide-toggle
            class="!scale-75"
            [checked]="!!item.data.checkedAt"
            (change)="toggleTransactionCheck.emit(item.data.id)"
            [attr.data-testid]="'toggle-check-tx-' + item.data.id"
            [attr.aria-label]="
              item.data.checkedAt
                ? 'Marquer comme non vérifié'
                : 'Marquer comme vérifié'
            "
          />
          <button
            matIconButton
            class="!size-8"
            (click)="deleteTransaction.emit(item.data.id)"
            [attr.data-testid]="'delete-tx-' + item.data.id"
            aria-label="Supprimer"
          >
            <mat-icon class="text-lg!">delete</mat-icon>
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }

    ::ng-deep .mat-expansion-panel-body {
      padding: 0 !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetGrid {
  readonly #dialog = inject(MatDialog);
  readonly #viewContainerRef = inject(ViewContainerRef);

  // Inputs
  readonly budgetLineItems = input.required<BudgetLineTableItem[]>();
  readonly transactionItems = input.required<
    {
      data: Transaction;
      metadata: { isLoading?: boolean; envelopeName?: string | null };
    }[]
  >();
  readonly transactions = input.required<TransactionViewModel[]>();
  readonly isMobile = input.required<boolean>();

  // Outputs
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly deleteTransaction = output<string>();
  readonly add = output<void>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  protected readonly categories = computed(() => {
    const items = this.budgetLineItems();

    const calcTotal = (list: BudgetLineTableItem[]) =>
      list.reduce((sum, i) => sum + i.data.amount, 0);

    const incomeItems = items.filter((item) => item.data.kind === 'income');
    const savingItems = items.filter((item) => item.data.kind === 'saving');
    const expenseItems = items.filter((item) => item.data.kind === 'expense');

    return [
      {
        title: 'Revenus',
        icon: 'trending_up',
        kind: 'income' as const,
        items: incomeItems,
        total: calcTotal(incomeItems),
      },
      {
        title: 'Épargnes',
        icon: 'savings',
        kind: 'saving' as const,
        items: savingItems,
        total: calcTotal(savingItems),
      },
      {
        title: 'Dépenses',
        icon: 'shopping_cart',
        kind: 'expense' as const,
        items: expenseItems,
        total: calcTotal(expenseItems),
      },
    ];
  });

  protected openDetailPanel(item: BudgetLineTableItem): void {
    const dialogData: BudgetDetailPanelData = {
      item,
      onAddTransaction: (budgetLine) => this.addTransaction.emit(budgetLine),
      onDeleteTransaction: (id) => this.deleteTransaction.emit(id),
      onToggleTransactionCheck: (id) => this.toggleTransactionCheck.emit(id),
    };

    this.#dialog.open(BudgetDetailPanel, {
      data: dialogData,
      viewContainerRef: this.#viewContainerRef,
      panelClass: 'side-sheet-panel',
      position: { right: '0', top: '0' },
      height: '100vh',
      width: '480px',
      maxWidth: '90vw',
      autoFocus: false,
      closeOnNavigation: true,
    });
  }
}
