import { Injectable } from '@nestjs/common';
import {
  BudgetLine,
  BudgetLineSnapshot,
} from '../../domain/entities/budget-line.entity';
import { BudgetLineDto } from '../api/dto/budget-line-swagger.dto';
import type { BudgetLine as ApiBudgetLine } from '@pulpe/shared';

@Injectable()
export class BudgetLineMapper {
  /**
   * Map BudgetLine entity to API DTO
   */
  toApi(budgetLine: BudgetLine): ApiBudgetLine {
    const snapshot = budgetLine.toSnapshot();

    return {
      id: snapshot.id,
      budgetId: snapshot.budgetId,
      templateLineId: snapshot.templateLineId,
      savingsGoalId: snapshot.savingsGoalId,
      name: snapshot.name,
      amount: snapshot.amount,
      kind: snapshot.kind,
      recurrence: snapshot.recurrence,
      isManuallyAdjusted: snapshot.isManuallyAdjusted,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Map multiple BudgetLine entities to API DTOs
   */
  toApiList(budgetLines: BudgetLine[]): ApiBudgetLine[] {
    return budgetLines.map((budgetLine) => this.toApi(budgetLine));
  }

  /**
   * Map BudgetLine snapshot to API DTO
   */
  snapshotToApi(snapshot: BudgetLineSnapshot): ApiBudgetLine {
    return {
      id: snapshot.id,
      budgetId: snapshot.budgetId,
      templateLineId: snapshot.templateLineId,
      savingsGoalId: snapshot.savingsGoalId,
      name: snapshot.name,
      amount: snapshot.amount,
      kind: snapshot.kind,
      recurrence: snapshot.recurrence,
      isManuallyAdjusted: snapshot.isManuallyAdjusted,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Calculate total amount from budget lines
   */
  calculateTotal(budgetLines: BudgetLine[]): number {
    return budgetLines.reduce((total, line) => {
      const monthlyEquivalent = line.getMonthlyEquivalent();
      return total + monthlyEquivalent.value;
    }, 0);
  }

  /**
   * Group budget lines by kind
   */
  groupByKind(budgetLines: BudgetLine[]): Record<string, BudgetLine[]> {
    return budgetLines.reduce(
      (groups, line) => {
        const kind = line.category.kind;
        if (!groups[kind]) {
          groups[kind] = [];
        }
        groups[kind].push(line);
        return groups;
      },
      {} as Record<string, BudgetLine[]>,
    );
  }

  /**
   * Get summary statistics for budget lines
   */
  getSummary(budgetLines: BudgetLine[]): {
    total: number;
    count: number;
    byKind: Record<string, { count: number; total: number }>;
    manuallyAdjusted: number;
  } {
    const byKind: Record<string, { count: number; total: number }> = {};
    let manuallyAdjusted = 0;

    for (const line of budgetLines) {
      const kind = line.category.kind;
      if (!byKind[kind]) {
        byKind[kind] = { count: 0, total: 0 };
      }
      byKind[kind].count++;
      byKind[kind].total += line.amount.value;

      if (line.category.isManuallyAdjusted) {
        manuallyAdjusted++;
      }
    }

    return {
      total: this.calculateTotal(budgetLines),
      count: budgetLines.length,
      byKind,
      manuallyAdjusted,
    };
  }
}
