export interface ImportedTransaction {
  budgetId: string;
  amount: number;
  name: string;
  kind: 'expense' | 'income';
  transactionDate: string;
  isOutOfBudget: boolean;
  category: string | null;
}

export class BulkImportTransactionsCommand {
  constructor(
    public readonly userId: string,
    public readonly transactions: ImportedTransaction[],
  ) {}
}
