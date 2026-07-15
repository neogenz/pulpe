import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type {
  BudgetLineRow,
  SpreadOccurrence,
  TransactionRow,
} from '../../domain/budget-line.entity';

@Injectable()
export class SupabaseBudgetLineSpreadReader {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findOccurrences(spreadGroupId: string): Promise<SpreadOccurrence[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('budget_line')
      .select('*, monthly_budget!inner(month, year, user_id)')
      .eq('spread_group_id', spreadGroupId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'findBudgetLinesBySpreadGroup',
          entityId: spreadGroupId,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const rows = data as Array<
      BudgetLineRow & {
        monthly_budget: { month: number; year: number; user_id: string };
      }
    >;
    const consumedByLine = await this.sumTransactionsByLine(
      rows.map((row) => row.id),
      dek,
    );
    return rows.map((row) => {
      const consumption = consumedByLine.get(row.id);
      return this.toOccurrence(
        row,
        dek,
        consumption?.consumed ?? 0,
        consumption?.transactionCount ?? 0,
      );
    });
  }

  private async sumTransactionsByLine(
    lineIds: string[],
    dek: Buffer,
  ): Promise<Map<string, { consumed: number; transactionCount: number }>> {
    const byLine = new Map<
      string,
      { consumed: number; transactionCount: number }
    >();
    if (lineIds.length === 0) return byLine;

    const { data, error } = await this.supabaseProvider.client
      .from('transaction')
      .select('budget_line_id, amount')
      .in('budget_line_id', lineIds);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'sumSpreadOccurrenceTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    for (const row of (data ?? []) as TransactionRow[]) {
      const lineId = row.budget_line_id;
      if (!lineId) continue;
      const { amount } = this.encryption.decryptRowAmountFields(row, dek);
      const previous = byLine.get(lineId) ?? {
        consumed: 0,
        transactionCount: 0,
      };
      byLine.set(lineId, {
        consumed: previous.consumed + amount,
        transactionCount: previous.transactionCount + 1,
      });
    }
    return byLine;
  }

  private toOccurrence(
    row: BudgetLineRow & { monthly_budget: { month: number; year: number } },
    dek: Buffer,
    consumed: number,
    transactionCount: number,
  ): SpreadOccurrence {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      budgetLineId: decrypted.id,
      budgetId: decrypted.budget_id,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
      name: decrypted.name,
      amount: decrypted.amount,
      consumed,
      transactionCount,
      originalAmount: decrypted.original_amount,
      originalCurrency:
        decrypted.original_currency as SpreadOccurrence['originalCurrency'],
      targetCurrency:
        decrypted.target_currency as SpreadOccurrence['targetCurrency'],
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      checkedAt: decrypted.checked_at,
    };
  }
}
