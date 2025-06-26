import { Injectable } from '@nestjs/common';
import {
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  type ExpenseType,
  type TransactionType,
} from '@pulpe/shared';

export interface TransactionDbEntity {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  budget_id: string;
  amount: number;
  type: TransactionType;
  expense_type: ExpenseType;
  name: string;
  description: string | null;
  is_recurring: boolean;
}

@Injectable()
export class TransactionMapper {
  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(transactionDb: TransactionDbEntity): Transaction {
    return {
      id: transactionDb.id,
      createdAt: transactionDb.created_at,
      updatedAt: transactionDb.updated_at,
      userId: transactionDb.user_id,
      budgetId: transactionDb.budget_id,
      amount: transactionDb.amount,
      type: transactionDb.type,
      expenseType: transactionDb.expense_type,
      name: transactionDb.name,
      description: transactionDb.description,
      isRecurring: transactionDb.is_recurring,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(transactionsDb: TransactionDbEntity[]): Transaction[] {
    return transactionsDb.map((transaction) => this.toApi(transaction));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(
    createDto: TransactionCreate,
    userId: string,
  ): Omit<TransactionDbEntity, 'id' | 'created_at' | 'updated_at'> {
    return {
      budget_id: createDto.budgetId,
      amount: createDto.amount,
      type: createDto.type,
      expense_type: createDto.expenseType,
      name: createDto.name,
      description: createDto.description || null,
      is_recurring: createDto.isRecurring,
      user_id: userId,
    };
  }

  /**
   * Transforme un DTO de mise à jour (camelCase) vers format DB (snake_case)
   */
  toDbUpdate(
    updateDto: TransactionUpdate,
  ): Partial<
    Pick<
      TransactionDbEntity,
      | 'budget_id'
      | 'amount'
      | 'type'
      | 'expense_type'
      | 'name'
      | 'description'
      | 'is_recurring'
    >
  > {
    const fieldMappings = this.getUpdateFieldMappings();
    const updateData: Record<string, unknown> = {};

    for (const [dtoField, dbField] of Object.entries(fieldMappings)) {
      if (updateDto[dtoField as keyof TransactionUpdate] !== undefined) {
        updateData[dbField] = updateDto[dtoField as keyof TransactionUpdate];
      }
    }

    return updateData;
  }

  private getUpdateFieldMappings(): Record<string, string> {
    return {
      budgetId: 'budget_id',
      amount: 'amount',
      type: 'type',
      expenseType: 'expense_type',
      name: 'name',
      description: 'description',
      isRecurring: 'is_recurring',
    };
  }
}
