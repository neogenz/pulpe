import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  type Budget,
  type BudgetCreate,
  type BudgetUpdate,
} from '@pulpe/shared';
import { type BudgetRow, type BudgetInsert } from './entities';

@Injectable()
export class BudgetMapper {
  /**
   * Valide les données venant de la DB (Supabase garantit la structure)
   */
  private validateDbEntity(dbEntity: unknown): BudgetRow {
    if (!dbEntity || typeof dbEntity !== 'object') {
      throw new InternalServerErrorException('Invalid DB data structure');
    }
    return dbEntity as BudgetRow;
  }

  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(budgetDb: BudgetRow): Budget {
    // Validate incoming DB data
    const validatedDb = this.validateDbEntity(budgetDb);

    // Map from DB entity (snake_case) to API model (camelCase) selon ARCHITECTURE.md
    const budget: Budget = {
      id: validatedDb.id,
      createdAt: validatedDb.created_at,
      updatedAt: validatedDb.updated_at,
      userId: validatedDb.user_id || undefined,
      month: validatedDb.month,
      year: validatedDb.year,
      description: validatedDb.description,
    };

    return budget;
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(budgetsDb: BudgetRow[]): Budget[] {
    return budgetsDb.map((budgetDb) => this.toApi(budgetDb));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(
    createDto: BudgetCreate,
    userId: string,
  ): Omit<BudgetInsert, 'id' | 'created_at' | 'updated_at'> {
    return {
      month: createDto.month,
      year: createDto.year,
      description: createDto.description,
      user_id: userId,
      template_id: null, // Selon les types Supabase
    };
  }

  /**
   * Transforme un DTO de mise à jour (camelCase) vers format DB (snake_case)
   */
  toDbUpdate(
    updateDto: BudgetUpdate,
  ): Partial<Pick<BudgetRow, 'month' | 'year' | 'description'>> {
    const updateData: Partial<
      Pick<BudgetRow, 'month' | 'year' | 'description'>
    > = {};

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

  private formatBudgetPeriod(budget: Budget | BudgetRow): string {
    const monthNames = [
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
    ];
    return `${monthNames[budget.month - 1]} ${budget.year}`;
  }

  private isBudgetCurrentMonth(budget: Budget | BudgetRow): boolean {
    const now = new Date();
    return (
      budget.year === now.getFullYear() && budget.month === now.getMonth() + 1
    );
  }

  private isBudgetFuture(budget: Budget | BudgetRow): boolean {
    const now = new Date();
    const budgetDate = new Date(budget.year, budget.month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    return budgetDate > currentDate;
  }

  private isBudgetPast(budget: Budget | BudgetRow): boolean {
    const now = new Date();
    const budgetDate = new Date(budget.year, budget.month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    return budgetDate < currentDate;
  }
}
