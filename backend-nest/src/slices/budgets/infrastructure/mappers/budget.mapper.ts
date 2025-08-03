import { Injectable } from '@nestjs/common';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import type { Tables } from '@/types/database.types';
import type { Budget as ApiBudget } from '@pulpe/shared';

@Injectable()
export class BudgetMapper {
  /**
   * Map from database entity to domain entity
   */
  toDomain(dbBudget: Tables<'monthly_budget'>): Budget {
    const period = BudgetPeriod.create(dbBudget.month, dbBudget.year).value!;

    const budgetResult = Budget.create(
      {
        userId: dbBudget.user_id,
        period,
        description: dbBudget.description,
        templateId: dbBudget.template_id,
      },
      dbBudget.id,
    );

    if (budgetResult.isFail()) {
      throw new Error(
        `Failed to create Budget from database: ${budgetResult.error.message}`,
      );
    }

    return budgetResult.value;
  }

  /**
   * Map from domain entity to database format
   */
  toPersistence(budget: Budget): Partial<Tables<'monthly_budget'>> {
    return {
      id: budget.id,
      user_id: budget.userId,
      month: budget.period.month,
      year: budget.period.year,
      description: budget.description,
      template_id: budget.templateId,
      created_at: budget.createdAt.toISOString(),
      updated_at: budget.updatedAt.toISOString(),
    };
  }

  /**
   * Map from domain entity to API response format
   */
  toApi(budget: Budget): ApiBudget {
    return {
      id: budget.id,
      userId: budget.userId,
      month: budget.period.month,
      year: budget.period.year,
      description: budget.description,
      templateId: budget.templateId,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }

  /**
   * Map from domain snapshot to API response format
   */
  snapshotToApi(snapshot: ReturnType<Budget['toSnapshot']>): ApiBudget {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      month: snapshot.month,
      year: snapshot.year,
      description: snapshot.description,
      templateId: snapshot.templateId,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Map list of domain entities to API response format
   */
  toApiList(budgets: Budget[]): ApiBudget[] {
    return budgets.map((budget) => this.toApi(budget));
  }

  /**
   * Map list of domain snapshots to API response format
   */
  snapshotListToApi(
    snapshots: ReturnType<Budget['toSnapshot']>[],
  ): ApiBudget[] {
    return snapshots.map((snapshot) => this.snapshotToApi(snapshot));
  }
}
