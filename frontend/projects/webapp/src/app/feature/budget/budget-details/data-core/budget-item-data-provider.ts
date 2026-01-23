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
  }): TableRowItem[] {
    // Both 'envelopes' and 'table' view modes use the same data structure
    // The difference is only in how the data is displayed (cards vs table)
    return buildViewData(params);
  }
}
