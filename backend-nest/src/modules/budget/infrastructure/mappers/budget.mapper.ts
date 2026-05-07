import { Injectable } from '@nestjs/common';
import { type Budget, type BudgetSparse, BudgetFormulas } from 'pulpe-shared';
import type { TablesInsert } from '../../../../types/database.types';
import type { BudgetRow } from '../../domain/budget.entity';
import type { BudgetAggregates } from '../persistence/supabase-budget.repository';

export type DecryptedBudgetRow = Omit<BudgetRow, 'ending_balance'> & {
  ending_balance: number | null;
};

export type EnrichedBudgetRow = DecryptedBudgetRow & { remaining: number };

@Injectable()
export class BudgetMapper {
  toApi(budgetDb: DecryptedBudgetRow | EnrichedBudgetRow): Budget {
    const base: Budget = {
      id: budgetDb.id,
      createdAt: budgetDb.created_at,
      updatedAt: budgetDb.updated_at,
      userId: budgetDb.user_id ?? undefined,
      templateId: budgetDb.template_id,
      month: budgetDb.month,
      year: budgetDb.year,
      description: budgetDb.description,
      endingBalance:
        typeof budgetDb.ending_balance === 'number'
          ? (budgetDb.ending_balance ?? undefined)
          : undefined,
    };

    if ('remaining' in budgetDb) {
      base.remaining = budgetDb.remaining;
    }

    return base;
  }

  toApiList(budgets: (DecryptedBudgetRow | EnrichedBudgetRow)[]): Budget[] {
    return budgets.map((b) => this.toApi(b));
  }

  toSparseApi(
    budgetDb: BudgetRow,
    requestedFields: string[],
    aggregates?: BudgetAggregates,
    rollover?: number,
  ): BudgetSparse {
    const sparse: BudgetSparse = { id: budgetDb.id };

    if (requestedFields.includes('month')) sparse.month = budgetDb.month;
    if (requestedFields.includes('year')) sparse.year = budgetDb.year;
    if (requestedFields.includes('rollover') && rollover !== undefined) {
      sparse.rollover = rollover;
    }

    if (aggregates) {
      if (requestedFields.includes('totalExpenses')) {
        sparse.totalExpenses = aggregates.totalExpenses;
      }
      if (requestedFields.includes('totalSavings')) {
        sparse.totalSavings = aggregates.totalSavings;
      }
      if (requestedFields.includes('totalIncome')) {
        sparse.totalIncome = aggregates.totalIncome;
      }
      if (requestedFields.includes('remaining')) {
        const available = BudgetFormulas.calculateAvailable(
          aggregates.totalIncome,
          rollover ?? 0,
        );
        sparse.remaining = BudgetFormulas.calculateRemaining(
          available,
          aggregates.totalExpenses,
        );
      }
    }

    return sparse;
  }

  toInsert(
    createDto: {
      month: number;
      year: number;
      description: string;
      templateId: string;
    },
    userId: string,
  ): TablesInsert<'monthly_budget'> {
    return {
      month: createDto.month,
      year: createDto.year,
      description: createDto.description,
      user_id: userId,
      template_id: createDto.templateId,
    };
  }
}
