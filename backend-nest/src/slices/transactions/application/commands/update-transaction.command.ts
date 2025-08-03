export class UpdateTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly amount?: number,
    public readonly name?: string,
    public readonly kind?: 'expense' | 'income',
    public readonly transactionDate?: string,
    public readonly isOutOfBudget?: boolean,
    public readonly category?: string | null,
  ) {}
}
