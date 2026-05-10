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
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
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
    const base: BudgetApi = {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      userId: entity.userId ?? undefined,
      templateId: entity.templateId,
      month: entity.month,
      year: entity.year,
      description: entity.description,
      endingBalance: entity.endingBalance ?? undefined,
    };

    if ('remaining' in entity) {
      base.remaining = entity.remaining;
    }

    return base;
  }

  toApiList(entities: (Budget | BudgetWithRemaining)[]): BudgetApi[] {
    return entities.map((b) => this.toApi(b));
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
    return {
      id: entity.id,
      budgetId: entity.budgetId,
      templateLineId: entity.templateLineId,
      savingsGoalId: entity.savingsGoalId,
      name: entity.name,
      amount: entity.amount,
      kind: entity.kind,
      recurrence: entity.recurrence,
      isManuallyAdjusted: entity.isManuallyAdjusted,
      checkedAt: entity.checkedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...mapCurrencyMetadataToApi({
        original_amount: entity.originalAmount,
        original_currency: entity.originalCurrency,
        target_currency: entity.targetCurrency,
        exchange_rate: entity.exchangeRate,
      }),
    };
  }

  toBudgetLineApiList(entities: BudgetLineDecrypted[]): BudgetLineApi[] {
    return entities.map((e) => this.toBudgetLineApi(e));
  }

  toTransactionApi(entity: TransactionDecrypted): TransactionApi {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      budgetId: entity.budgetId,
      budgetLineId: entity.budgetLineId,
      amount: entity.amount,
      name: entity.name,
      kind: entity.kind,
      transactionDate: entity.transactionDate,
      category: entity.category,
      checkedAt: entity.checkedAt,
      ...mapCurrencyMetadataToApi({
        original_amount: entity.originalAmount,
        original_currency: entity.originalCurrency,
        target_currency: entity.targetCurrency,
        exchange_rate: entity.exchangeRate,
      }),
    };
  }

  toTransactionApiList(entities: TransactionDecrypted[]): TransactionApi[] {
    return entities.map((e) => this.toTransactionApi(e));
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
