import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type {
  BudgetLineCheckedTransaction,
  SpreadOccurrence,
} from '../budget-line.entity';

export const BUDGET_LINE_CHECK_TRANSACTIONS_PORT = Symbol(
  'BUDGET_LINE_CHECK_TRANSACTIONS_PORT',
);

export interface BudgetLineCheckTransactionsPort {
  execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BudgetLineCheckedTransaction[]>;
}

export const BUDGET_LINE_SPREAD_OCCURRENCES_PORT = Symbol(
  'BUDGET_LINE_SPREAD_OCCURRENCES_PORT',
);

export interface BudgetLineSpreadOccurrencesPort {
  execute(
    spreadGroupId: string,
    user: AuthenticatedUser,
  ): Promise<SpreadOccurrence[]>;
}
