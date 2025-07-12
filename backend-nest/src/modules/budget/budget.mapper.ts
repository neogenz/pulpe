import { Injectable } from '@nestjs/common';
import {
  type Budget,
  type BudgetCreate,
  type BudgetUpdate,
} from '@pulpe/shared';
import { type BudgetRow, type BudgetInsert } from './entities';

@Injectable()
export class BudgetMapper {
  /**
   * Transform database row (snake_case) to API entity (camelCase)
   */
  toApi(budgetDb: BudgetRow): Budget {
    return {
      id: budgetDb.id,
      createdAt: budgetDb.created_at,
      updatedAt: budgetDb.updated_at,
      userId: budgetDb.user_id ?? undefined,
      month: budgetDb.month,
      year: budgetDb.year,
      description: budgetDb.description,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(budgetsDb: BudgetRow[]): Budget[] {
    return budgetsDb.map((budgetDb) => this.toApi(budgetDb));
  }

  /**
   * Transform create DTO (camelCase) to database insert (snake_case)
   */
  toInsert(createDto: BudgetCreate, userId: string): BudgetInsert {
    return {
      month: createDto.month,
      year: createDto.year,
      description: createDto.description,
      user_id: userId,
      template_id: '', // Template ID requis par le type mais peut être vide
    };
  }

  /**
   * Transform update DTO (camelCase) to database update (snake_case)
   */
  toUpdate(updateDto: BudgetUpdate): Partial<BudgetInsert> {
    const updateData: Partial<BudgetInsert> = {};

    if (updateDto.month !== undefined) {
      updateData.month = updateDto.month;
    }
    if (updateDto.year !== undefined) {
      updateData.year = updateDto.year;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    return updateData;
  }

  private readonly monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ] as const;

  private formatBudgetPeriod(budget: Budget | BudgetRow): string {
    return `${this.monthNames[budget.month - 1]} ${budget.year}`;
  }

  private isBudgetCurrentMonth(
    budget: Budget | BudgetRow,
    now = new Date(),
  ): boolean {
    return (
      budget.year === now.getFullYear() && budget.month === now.getMonth() + 1
    );
  }

  private isBudgetFuture(
    budget: Budget | BudgetRow,
    now = new Date(),
  ): boolean {
    const budgetDate = new Date(budget.year, budget.month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    return budgetDate > currentDate;
  }

  private isBudgetPast(budget: Budget | BudgetRow, now = new Date()): boolean {
    const budgetDate = new Date(budget.year, budget.month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    return budgetDate < currentDate;
  }
}
