import { Injectable } from '@nestjs/common';
import {
  type Budget as BudgetApi,
  type BudgetLine as BudgetLineApi,
  type BudgetSparse,
  type Transaction as TransactionApi,
  type BudgetDetailsResponse,
  type BudgetWithDetails as BudgetWithDetailsApi,
  type BudgetExportResponse,
  BudgetFormulas,
} from 'pulpe-shared';
import {
  mapBudgetLineToApi,
  mapBudgetLinesToApi,
} from '@common/utils/budget-line-api.mapper';
import {
  mapBudgetToApi,
  mapBudgetsToApi,
} from '@common/utils/budget-api.mapper';
import {
  mapTransactionToApi,
  mapTransactionsToApi,
} from '@common/utils/transaction-api.mapper';
import type {
  Budget,
  BudgetAggregates,
  BudgetLineDecrypted,
  TransactionDecrypted,
  BudgetWithRemaining,
  BudgetWithDetails,
  BudgetForExport,
  SparseBudgetItem,
} from '../../domain/budget.entity';

@Injectable()
export class BudgetMapper {
  toApi(entity: Budget | BudgetWithRemaining): BudgetApi {
    return mapBudgetToApi(entity);
  }

  toApiList(entities: (Budget | BudgetWithRemaining)[]): BudgetApi[] {
    return mapBudgetsToApi(entities);
  }

  toSparseApi(
    entity: Budget,
    requestedFields: string[],
    aggregates?: BudgetAggregates,
    rollover?: number,
  ): BudgetSparse {
    const sparse: BudgetSparse = { id: entity.id };

    if (requestedFields.includes('month')) sparse.month = entity.month;
    if (requestedFields.includes('year')) sparse.year = entity.year;
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

  toBudgetLineApi(entity: BudgetLineDecrypted): BudgetLineApi {
    return mapBudgetLineToApi(entity);
  }

  toBudgetLineApiList(entities: BudgetLineDecrypted[]): BudgetLineApi[] {
    return mapBudgetLinesToApi(entities);
  }

  toTransactionApi(entity: TransactionDecrypted): TransactionApi {
    return mapTransactionToApi(entity);
  }

  toTransactionApiList(entities: TransactionDecrypted[]): TransactionApi[] {
    return mapTransactionsToApi(entities);
  }

  toSparseApiList(items: SparseBudgetItem[]): BudgetSparse[] {
    return items.map((item) =>
      this.toSparseApi(
        item.budget,
        item.requestedFields,
        item.aggregates,
        item.rollover,
      ),
    );
  }

  toBudgetDetailsResponse(composite: BudgetWithDetails): BudgetDetailsResponse {
    return {
      success: true as const,
      data: {
        budget: {
          ...this.toApi(composite.budget),
          rollover: composite.rollover,
          previousBudgetId: composite.previousBudgetId,
        },
        transactions: this.toTransactionApiList(composite.transactions),
        budgetLines: this.toBudgetLineApiList(composite.budgetLines),
      },
    };
  }

  toExportItem(composite: BudgetForExport): BudgetWithDetailsApi {
    return {
      ...this.toApi(composite.budget),
      rollover: composite.rollover,
      previousBudgetId: composite.previousBudgetId,
      remaining: composite.remaining,
      transactions: this.toTransactionApiList(composite.transactions),
      budgetLines: this.toBudgetLineApiList(composite.budgetLines),
    };
  }

  toExportResponse(composites: BudgetForExport[]): BudgetExportResponse {
    return {
      success: true as const,
      data: {
        exportDate: new Date().toISOString(),
        totalBudgets: composites.length,
        budgets: composites.map((c) => this.toExportItem(c)),
      },
    };
  }
}
