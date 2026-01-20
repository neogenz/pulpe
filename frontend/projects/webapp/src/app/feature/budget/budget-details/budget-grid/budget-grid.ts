import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  type Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { BudgetLineTableItem } from '../data-core';
import {
  BudgetDetailPanel,
  type BudgetDetailPanelData,
} from './budget-detail-panel';
import { BudgetGridCard } from './budget-grid-card';
import { BudgetGridMobileCard } from './budget-grid-mobile-card';
import { BudgetGridSection } from './budget-grid-section';

/**
 * Grid view component displaying budget lines as cards.
 * Handles both desktop grid layout and mobile card list.
 */
@Component({
  selector: 'pulpe-budget-grid',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    BudgetGridCard,
    BudgetGridMobileCard,
    BudgetGridSection,
  ],
  template: `
    @if (isMobile()) {
      <!-- Mobile view -->
      <div class="flex flex-col gap-3">
        @for (item of budgetLineItems(); track item.data.id) {
          <pulpe-budget-grid-mobile-card
            [item]="item"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
            (addTransaction)="addTransaction.emit($event)"
            (viewTransactions)="viewTransactions.emit($event)"
            (resetFromTemplate)="resetFromTemplate.emit($event)"
            (toggleCheck)="toggleCheck.emit($event)"
          />
        } @empty {
          <ng-container *ngTemplateOutlet="emptyState" />
        }

        <!-- Transactions section -->
        @if (transactionItems().length > 0) {
          <div class="pt-4 border-outline-variant">
            <h3 class="text-title-medium text-on-surface-variant mb-3">
              Transactions
            </h3>
            @for (item of transactionItems(); track item.data.id) {
              <ng-container
                *ngTemplateOutlet="
                  mobileTransactionCard;
                  context: { $implicit: item }
                "
              />
            }
          </div>
        }
      </div>
    } @else {
      <!-- Desktop Card Grid View -->
      @if (budgetLineItems().length === 0) {
        <ng-container *ngTemplateOutlet="emptyState" />
      } @else {
        <div class="space-y-4">
          @for (category of categories(); track category.title) {
            @if (category.items.length > 0) {
              <pulpe-budget-grid-section
                title="{{ category.title }}"
                icon="{{ category.icon }}"
                [itemCount]="category.items.length"
              >
                @for (item of category.items; track item.data.id) {
                  <pulpe-budget-grid-card
                    [item]="item"
                    (cardClick)="openDetailPanel($event)"
                    (edit)="edit.emit($event)"
                    (delete)="delete.emit($event)"
                    (addTransaction)="addTransaction.emit($event)"
                    (resetFromTemplate)="resetFromTemplate.emit($event)"
                    (toggleCheck)="toggleCheck.emit($event)"
                  />
                }
              </pulpe-budget-grid-section>
            }
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
          <mat-icon class="text-primary text-3xl!"
            >account_balance_wallet</mat-icon
          >
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

    <!-- Mobile Transaction Card Template -->
    <ng-template #mobileTransactionCard let-item>
      <mat-card
        appearance="outlined"
        class="mb-3"
        [class.opacity-50]="item.metadata.isLoading"
        [attr.data-testid]="'transaction-card-' + item.data.id"
      >
        <mat-card-content>
          <div
            class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1 items-center"
          >
            <div class="min-w-0 space-y-0.5">
              <span class="text-body-medium font-medium block truncate">
                {{ item.data.name }}
              </span>
              <div class="text-label-small text-on-surface-variant">
                {{ item.data.kind }}
              </div>
              @if (item.metadata.envelopeName) {
                <div
                  class="flex items-center text-label-small text-on-surface-variant"
                >
                  <mat-icon class="text-sm! leading-none! w-4! h-4!"
                    >folder</mat-icon
                  >
                  <span>{{ item.metadata.envelopeName }}</span>
                </div>
              }
            </div>
            <div
              class="text-title-medium font-bold"
              [class.text-financial-income]="item.data.amount > 0"
              [class.text-error]="item.data.amount < 0"
            >
              {{ item.data.amount }}
            </div>
            <div>
              <button
                matIconButton
                (click)="deleteTransaction.emit(item.data.id)"
                [attr.data-testid]="'delete-tx-' + item.data.id"
              >
                <mat-icon class="text-xl!">delete</mat-icon>
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetGrid {
  readonly #dialog = inject(MatDialog);

  // Inputs
  readonly budgetLineItems = input.required<BudgetLineTableItem[]>();
  readonly transactionItems = input.required<
    {
      data: Transaction;
      metadata: { isLoading?: boolean; envelopeName?: string | null };
    }[]
  >();
  readonly transactions = input.required<Signal<Transaction[]>>();
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
    const income = {
      title: 'Revenus',
      icon: 'trending_up',
      items: items.filter((item) => item.data.kind === 'income'),
    };
    const saving = {
      title: 'Épargnes',
      icon: 'savings',
      items: items.filter((item) => item.data.kind === 'saving'),
    };
    const expense = {
      title: 'Dépenses',
      icon: 'shopping_cart',
      items: items.filter((item) => item.data.kind === 'expense'),
    };
    return [income, saving, expense];
  });

  protected openDetailPanel(item: BudgetLineTableItem): void {
    const dialogData: BudgetDetailPanelData = {
      item,
      transactions: this.transactions(),
      onAddTransaction: (budgetLine) => this.addTransaction.emit(budgetLine),
      onDeleteTransaction: (id) => this.deleteTransaction.emit(id),
      onToggleTransactionCheck: (id) => this.toggleTransactionCheck.emit(id),
    };

    this.#dialog.open(BudgetDetailPanel, {
      data: dialogData,
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
