import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import type {
  BudgetLineSearchResult,
  TransactionSearchResult,
  TransactionKind,
  TransactionRecurrence,
} from '@pulpe/shared';

type SearchResult = BudgetLineSearchResult | TransactionSearchResult;

function isTransaction(
  result: SearchResult,
): result is TransactionSearchResult {
  return 'transactionDate' in result;
}

@Component({
  selector: 'pulpe-search-result-item',
  imports: [MatCardModule, MatIconModule, CurrencyPipe],
  template: `
    <mat-card
      class="search-result-card cursor-pointer hover:bg-surface-container-high transition-colors"
      (click)="itemClicked.emit()"
      [attr.data-testid]="'search-result-' + result().id"
    >
      <mat-card-content class="!p-4">
        <div class="flex items-start gap-3">
          <!-- Icon based on kind -->
          <mat-icon class="text-on-surface-variant" [class]="getIconClass()">
            {{ getIcon() }}
          </mat-icon>

          <!-- Main content -->
          <div class="flex-1 min-w-0">
            <!-- Name and Amount -->
            <div class="flex justify-between items-start gap-2 mb-1">
              <h3 class="text-title-medium text-on-surface m-0 truncate">
                {{ result().name }}
              </h3>
              <span
                class="text-title-medium font-semibold whitespace-nowrap"
                [class]="getAmountColorClass()"
              >
                {{ result().amount | currency: 'CHF' : 'symbol' : '1.0-2' }}
              </span>
            </div>

            <!-- Type info -->
            <div class="text-body-small text-on-surface-variant mb-1">
              <span>{{ getKindLabel() }}</span>
              @if (!isTransactionResult()) {
                <span class="mx-1">•</span>
                <span>{{ getRecurrenceLabel() }}</span>
              }
            </div>

            <!-- Budget context -->
            <div class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">event</mat-icon>
              <span>{{ getBudgetLabel() }}</span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .search-result-card {
      margin-bottom: 0;
    }

    mat-card-content {
      padding: 16px !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultItem {
  // Input
  result = input.required<SearchResult>();

  // Output
  itemClicked = output<void>();

  isTransactionResult(): boolean {
    return isTransaction(this.result());
  }

  getIcon(): string {
    const kind = this.result().kind;
    switch (kind) {
      case 'income':
        return 'trending_up';
      case 'expense':
        return 'shopping_cart';
      case 'saving':
        return 'savings';
      default:
        return 'attach_money';
    }
  }

  getIconClass(): string {
    const kind = this.result().kind;
    switch (kind) {
      case 'income':
        return 'text-financial-income';
      case 'expense':
        return 'text-financial-negative';
      case 'saving':
        return 'text-financial-neutral';
      default:
        return '';
    }
  }

  getAmountColorClass(): string {
    const kind = this.result().kind;
    switch (kind) {
      case 'income':
        return 'text-financial-income';
      case 'expense':
      case 'saving':
        return 'text-financial-negative';
      default:
        return 'text-on-surface';
    }
  }

  getKindLabel(): string {
    const kind = this.result().kind;
    switch (kind) {
      case 'income':
        return 'Revenu';
      case 'expense':
        return 'Dépense';
      case 'saving':
        return 'Épargne';
      default:
        return '';
    }
  }

  getRecurrenceLabel(): string {
    if (isTransaction(this.result())) {
      return '';
    }
    const recurrence = (this.result() as BudgetLineSearchResult).recurrence;
    return recurrence === 'fixed' ? 'Tous les mois' : 'Une seule fois';
  }

  getBudgetLabel(): string {
    const result = this.result();
    const monthNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const monthName = monthNames[result.budgetMonth - 1];
    return `${monthName} ${result.budgetYear} - ${result.budgetDescription}`;
  }
}
