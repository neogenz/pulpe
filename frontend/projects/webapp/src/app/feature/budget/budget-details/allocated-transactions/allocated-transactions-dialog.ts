import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { DatePipe, CurrencyPipe } from '@angular/common';
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { type BudgetLine, type Transaction } from '@pulpe/shared';
import { TransactionIconPipe } from '@ui/transaction-display';
import { map } from 'rxjs/operators';

export interface AllocatedTransactionsDialogData {
  budgetLine: BudgetLine;
  allocatedTransactions: Transaction[];
}

export interface AllocatedTransactionsDialogResult {
  action: 'add' | 'edit' | 'delete';
  transaction?: Transaction;
}

@Component({
  selector: 'pulpe-allocated-transactions-dialog',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
    DatePipe,
    CurrencyPipe,
    TransactionIconPipe,
  ],
  template: `
    <div class="flex flex-col h-full">
      <!-- Drag handle for bottom sheet -->
      @if (isBottomSheet()) {
        <div class="flex justify-center pt-3 pb-2">
          <div class="w-9 h-1 bg-outline-variant rounded-sm"></div>
        </div>
      }

      <!-- Header -->
      <div class="flex items-center justify-between gap-2 px-4 py-3">
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="inline-flex items-center justify-center size-10 rounded-full shrink-0"
            [class]="kindBadgeClass()"
          >
            <mat-icon>{{ data.budgetLine.kind | transactionIcon }}</mat-icon>
          </span>
          <h2 class="text-title-large text-on-surface m-0 truncate">
            {{ data.budgetLine.name }}
          </h2>
        </div>
        <button
          matIconButton
          (click)="onClose()"
          aria-label="Fermer"
          class="shrink-0"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary: Card-like structure -->
      <div class="px-4 pb-3">
        <div
          class="grid grid-cols-3 gap-2 p-3 bg-surface-container rounded-xl text-center"
        >
          <div class="flex flex-col gap-0.5">
            <span class="text-label-small text-on-surface-variant">Prévu</span>
            <span
              class="text-body-medium font-medium"
              [class]="kindTextClass()"
            >
              {{
                plannedAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-label-small text-on-surface-variant"
              >Consommé</span
            >
            <span
              class="text-body-medium font-medium"
              [class]="kindTextClass()"
            >
              {{
                consumedAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-label-small text-on-surface-variant"
              >Restant</span
            >
            <span
              class="text-body-medium font-medium"
              [class]="remainingClass()"
            >
              {{
                remainingAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
        </div>
      </div>

      <mat-divider />

      <!-- Transactions list - scrollable content -->
      <div class="flex-1 overflow-y-auto px-4">
        @if (hasTransactions()) {
          <mat-list class="-mx-4">
            @for (
              transaction of sortedTransactions();
              track transaction.id;
              let isLast = $last
            ) {
              <mat-list-item class="!h-auto !py-3">
                <div class="flex items-center justify-between w-full gap-2">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <mat-icon
                      class="!text-xl opacity-60 shrink-0"
                      [class]="kindTextClass()"
                    >
                      {{ transaction.kind | transactionIcon }}
                    </mat-icon>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="text-body-medium truncate">
                        {{ transaction.name }}
                      </span>
                      <span class="text-body-small text-on-surface-variant">
                        {{ transaction.transactionDate | date: 'dd.MM.yyyy' }}
                        @if (transaction.category) {
                          · {{ transaction.category }}
                        }
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <span
                      class="text-body-medium font-medium whitespace-nowrap"
                      [class]="kindTextClass()"
                    >
                      {{
                        transaction.amount
                          | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                      }}
                    </span>
                    <!-- Mobile: Menu dropdown -->
                    <button
                      matIconButton
                      [matMenuTriggerFor]="actionMenu"
                      [attr.data-testid]="'transaction-menu-' + transaction.id"
                      aria-label="Actions"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #actionMenu="matMenu">
                      <button
                        mat-menu-item
                        (click)="onEditTransaction(transaction)"
                        data-testid="edit-transaction"
                      >
                        <mat-icon>edit</mat-icon>
                        <span>Modifier</span>
                      </button>
                      <button
                        mat-menu-item
                        (click)="onDeleteTransaction(transaction)"
                        data-testid="delete-transaction"
                      >
                        <mat-icon color="warn">delete</mat-icon>
                        <span class="text-error">Supprimer</span>
                      </button>
                    </mat-menu>
                  </div>
                </div>
              </mat-list-item>
              @if (!isLast) {
                <mat-divider />
              }
            }
          </mat-list>
        } @else {
          <div class="py-10 text-center text-on-surface-variant">
            <mat-icon class="!text-5xl mb-3 opacity-40">receipt_long</mat-icon>
            <p class="text-body-large m-0">Aucune transaction</p>
            <p class="text-body-medium mt-1 opacity-70">
              Ajoutez votre première transaction
            </p>
          </div>
        }
      </div>

      <!-- Action buttons - fixed footer -->
      <div
        class="flex flex-col gap-3 p-4 border-t border-outline-variant bg-surface"
      >
        <button
          matButton="filled"
          (click)="onAddTransaction()"
          data-testid="add-transaction"
          class="w-full"
        >
          <mat-icon>add</mat-icon>
          Ajouter une transaction
        </button>
        <button
          matButton
          (click)="onClose()"
          data-testid="close-dialog"
          class="w-full"
        >
          Fermer
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsDialog {
  // Dual injection: component can be opened via Dialog or BottomSheet
  #dialogRef = inject(MatDialogRef<AllocatedTransactionsDialog>, {
    optional: true,
  });
  #bottomSheetRef = inject(MatBottomSheetRef<AllocatedTransactionsDialog>, {
    optional: true,
  });

  // Data can come from Dialog or BottomSheet
  data =
    inject<AllocatedTransactionsDialogData>(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? inject<AllocatedTransactionsDialogData>(MAT_BOTTOM_SHEET_DATA);

  // Mobile detection
  #breakpointObserver = inject(BreakpointObserver);
  isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Check if opened as bottom sheet (for conditional UI like drag handle)
  isBottomSheet = computed(() => !!this.#bottomSheetRef);

  // Use signal to track transactions locally if needed for updates
  #transactions = signal(this.data.allocatedTransactions);

  plannedAmount = computed(() => this.data.budgetLine.amount);

  consumedAmount = computed(() =>
    this.#transactions().reduce((sum, t) => sum + t.amount, 0),
  );

  remainingAmount = computed(
    () => this.plannedAmount() - this.consumedAmount(),
  );

  remainingClass = computed(() => {
    const remaining = this.remainingAmount();
    if (remaining < 0) return 'text-financial-negative font-medium';
    if (remaining === 0) return 'text-on-surface-variant';
    return 'text-financial-positive';
  });

  kindBadgeClass = computed(() => {
    const kind = this.data.budgetLine.kind;
    return {
      income: 'bg-primary-container text-on-primary-container',
      expense: 'bg-secondary-container text-on-secondary-container',
      saving: 'bg-tertiary-container text-on-tertiary-container',
    }[kind];
  });

  kindTextClass = computed(() => {
    const kind = this.data.budgetLine.kind;
    return {
      income: 'text-financial-income',
      expense: 'text-financial-expense',
      saving: 'text-financial-savings',
    }[kind];
  });

  hasTransactions = computed(() => this.#transactions().length > 0);

  sortedTransactions = computed(() =>
    [...this.#transactions()].sort(
      (a, b) =>
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime(),
    ),
  );

  onAddTransaction(): void {
    this.#close({ action: 'add' });
  }

  onEditTransaction(transaction: Transaction): void {
    this.#close({ action: 'edit', transaction });
  }

  onDeleteTransaction(transaction: Transaction): void {
    this.#close({ action: 'delete', transaction });
  }

  onClose(): void {
    this.#close();
  }

  // Unified close method for Dialog or BottomSheet
  #close(result?: AllocatedTransactionsDialogResult): void {
    if (this.#dialogRef) {
      this.#dialogRef.close(result);
    } else if (this.#bottomSheetRef) {
      this.#bottomSheetRef.dismiss(result);
    }
  }
}
