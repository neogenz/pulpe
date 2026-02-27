import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FinancialKindDirective } from '@ui/financial-kind';
import { TransactionLabelPipe } from '@ui/transaction-display';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { TransactionViewModel } from '../models/transaction-view-model';
import type { BudgetLineTableItem } from '../data-core';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { TransactionActionMenu } from '../components/transaction-action-menu';
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
    CurrencyPipe,
    DatePipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    BudgetGridCard,
    BudgetGridMobileCard,
    BudgetGridSection,
    BudgetKindIndicator,
    FinancialKindDirective,
    TransactionActionMenu,
    TransactionLabelPipe,
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
      @if (
        budgetLineItems().length === 0 && freeTransactionItems().length === 0
      ) {
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

          @if (freeTransactionItems().length > 0) {
            <pulpe-budget-grid-section
              title="Hors enveloppes"
              icon="receipt_long"
              [itemCount]="freeTransactionItems().length"
              data-testid="free-transactions-section"
            >
              @for (item of freeTransactionItems(); track item.data.id) {
                <ng-container
                  *ngTemplateOutlet="
                    desktopFreeTransactionCard;
                    context: { $implicit: item }
                  "
                />
              }
            </pulpe-budget-grid-section>
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
          <mat-icon class="text-primary shrink-0"
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
        class="mb-3 min-h-[120px] border-dashed bg-surface"
        [class.opacity-60]="item.metadata.isLoading"
        [attr.data-testid]="'transaction-card-' + item.data.id"
      >
        <mat-card-content class="p-4">
          <!-- Row 1: Kind dot + name + menu -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <pulpe-budget-kind-indicator [kind]="item.data.kind" />
              <span class="text-title-small font-medium truncate">
                {{ item.data.name }}
              </span>
            </div>
            <pulpe-transaction-action-menu
              [transaction]="item.data"
              menuIcon="more_horiz"
              buttonClass="!-mr-2 !-mt-1"
              (edit)="editTransaction.emit($event)"
              (delete)="deleteTransaction.emit($event)"
            />
          </div>

          <!-- Row 2: Amount + date chip -->
          <div class="flex items-center justify-between mb-3">
            <div
              class="ph-no-capture text-headline-small font-bold"
              [pulpeFinancialKind]="item.data.kind"
              [attr.data-testid]="'transaction-amount-' + item.data.id"
            >
              {{ item.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
            </div>
            @if (item.data.transactionDate) {
              <span
                class="text-label-small text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"
              >
                {{
                  item.data.transactionDate | date: 'dd.MM.yyyy' : '' : 'fr-CH'
                }}
              </span>
            }
          </div>

          <!-- Footer: Kind label + toggle -->
          <div
            class="flex items-center justify-between pt-2 border-t border-outline-variant/30"
          >
            <span class="text-label-small text-on-surface-variant">
              {{ item.data.kind | transactionLabel }}
            </span>
            <mat-slide-toggle
              [checked]="!!item.data.checkedAt"
              (change)="toggleTransactionCheck.emit(item.data.id)"
              (click)="$event.stopPropagation()"
              [attr.data-testid]="'toggle-check-tx-' + item.data.id"
              [attr.aria-label]="
                item.data.checkedAt ? 'Retirer le pointage' : 'Pointer'
              "
            />
          </div>
        </mat-card-content>
      </mat-card>
    </ng-template>

    <!-- Desktop Free Transaction Card Template -->
    <ng-template #desktopFreeTransactionCard let-item>
      <div
        class="rounded-corner-large border border-dashed border-outline-variant p-5
               min-h-[120px] h-full flex flex-col bg-surface
               transition-all duration-200"
        [class.opacity-60]="item.metadata.isLoading"
        [attr.data-testid]="'transaction-card-' + item.data.id"
      >
        <!-- Header: Kind dot + name + menu -->
        <div class="flex items-start justify-between gap-2 mb-4 flex-1">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <pulpe-budget-kind-indicator [kind]="item.data.kind" />
            <span class="text-title-small font-medium truncate">{{
              item.data.name
            }}</span>
          </div>
          <pulpe-transaction-action-menu
            [transaction]="item.data"
            buttonClass="!-mr-2 !-mt-1"
            (edit)="editTransaction.emit($event)"
            (delete)="deleteTransaction.emit($event)"
          />
        </div>

        <div
          class="ph-no-capture text-headline-small font-bold mb-2"
          [pulpeFinancialKind]="item.data.kind"
          [attr.data-testid]="'transaction-amount-' + item.data.id"
        >
          {{ item.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
        </div>

        <!-- Footer: Kind label + date + toggle -->
        <div
          class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
        >
          <div class="flex items-center gap-2">
            <span class="text-label-small text-on-surface-variant">
              {{ item.data.kind | transactionLabel }}
            </span>
            @if (item.data.transactionDate) {
              <span
                class="text-label-small text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"
              >
                {{
                  item.data.transactionDate | date: 'dd.MM.yyyy' : '' : 'fr-CH'
                }}
              </span>
            }
          </div>
          <mat-slide-toggle
            [checked]="!!item.data.checkedAt"
            (change)="toggleTransactionCheck.emit(item.data.id)"
            (click)="$event.stopPropagation()"
            [attr.data-testid]="'toggle-check-tx-' + item.data.id"
            [attr.aria-label]="
              item.data.checkedAt ? 'Retirer le pointage' : 'Pointer'
            "
          />
        </div>
      </div>
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
  readonly editTransaction = output<Transaction>();
  readonly add = output<void>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  protected readonly freeTransactionItems = computed(() =>
    this.transactionItems().filter((item) => !item.data.budgetLineId),
  );

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
      onAddTransaction: (budgetLine) => this.addTransaction.emit(budgetLine),
      onDeleteTransaction: (id) => this.deleteTransaction.emit(id),
      onToggleTransactionCheck: (id) => this.toggleTransactionCheck.emit(id),
      onEditTransaction: (tx) => this.editTransaction.emit(tx),
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
