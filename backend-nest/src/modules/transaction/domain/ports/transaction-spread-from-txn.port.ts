import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TransactionSpreadFromTxnCreate } from 'pulpe-shared';
import type { Database } from '../../../../types/database.types';

type TransactionKind = Database['public']['Enums']['transaction_kind'];
type TransactionRecurrence =
  Database['public']['Enums']['transaction_recurrence'];

export const TRANSACTION_SPREAD_FROM_TXN_PORT = Symbol(
  'TRANSACTION_SPREAD_FROM_TXN_PORT',
);

export interface TransactionSpreadBudgetLine {
  id: string;
  budgetId: string;
  templateLineId: string | null;
  savingsGoalId: string | null;
  spreadGroupId: string | null;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isManuallyAdjusted: boolean;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSpreadBudget {
  id: string;
  userId: string | null;
  templateId: string;
  month: number;
  year: number;
  description: string;
  endingBalance: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSpreadFanOutResult {
  spreadGroupId: string;
  lines: TransactionSpreadBudgetLine[];
  createdBudgets: TransactionSpreadBudget[];
  skippedMonths: { month: number; year: number }[];
}

export interface TransactionSpreadFromTxnPort {
  execute(
    id: string,
    dto: TransactionSpreadFromTxnCreate,
    user: AuthenticatedUser,
  ): Promise<TransactionSpreadFanOutResult>;
}
