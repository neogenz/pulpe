import { Injectable } from '@angular/core';
import type { Transaction, BudgetLine } from 'pulpe-shared';
import type { TableRowItem } from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';
import { buildEnvelopesViewData } from './envelopes-view-builder';

@Injectable()
export class BudgetTableDataProvider {
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
    viewMode?: BudgetTableViewMode;
  }): TableRowItem[] {
    // Both 'envelopes' and 'table' view modes use the same data structure
    // The difference is only in how the data is displayed (cards vs table)
    return buildEnvelopesViewData(params);
  }
}
