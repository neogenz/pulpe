import { Injectable } from '@angular/core';
import type { Transaction, BudgetLine } from 'pulpe-shared';
import type { TableRowItem } from './budget-item-models';
import type { BudgetViewMode } from './budget-view-mode';
import { buildViewData } from './budget-item-data-builder';

@Injectable()
export class BudgetItemDataProvider {
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    viewMode?: BudgetViewMode;
    searchText?: string;
  }): TableRowItem[] {
    return buildViewData(params);
  }
}
