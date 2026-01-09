import { Injectable } from '@angular/core';
import type { Transaction, BudgetLine } from 'pulpe-shared';
import type { TableRowItem } from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';
import { buildNestedTransactionViewData } from './nested-transaction-view-builder';
import { buildEnvelopesViewData } from './envelopes-view-builder';

@Injectable()
export class BudgetTableDataProvider {
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
    viewMode?: BudgetTableViewMode;
  }): TableRowItem[] {
    if (params.viewMode === 'transactions') {
      return buildNestedTransactionViewData(params);
    }
    return buildEnvelopesViewData(params);
  }
}
