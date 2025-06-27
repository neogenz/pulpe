import { Injectable, BadRequestException } from '@nestjs/common';
import {
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  transactionCreateSchema,
} from '@pulpe/shared';
import {
  type TransactionRow,
  type TransactionInsert,
} from './entities/transaction.entity';

@Injectable()
export class TransactionMapper {
  /**
   * Transform database row (snake_case) to API entity (camelCase)
   */
  toApi(transactionDb: TransactionRow): Transaction {
    return {
      id: transactionDb.id,
      createdAt: transactionDb.created_at,
      updatedAt: transactionDb.updated_at,
      userId: transactionDb.user_id ?? undefined,
      budgetId: transactionDb.budget_id,
      amount: transactionDb.amount,
      type: transactionDb.type,
      expenseType: transactionDb.expense_type,
      name: transactionDb.name,
      description: transactionDb.description ?? undefined,
      isRecurring: transactionDb.is_recurring,
    };
  }

  /**
   * Transform multiple database rows to API entities
   */
  toApiList(transactionsDb: TransactionRow[]): Transaction[] {
    return transactionsDb.map((transaction) => this.toApi(transaction));
  }

  /**
   * Transform create DTO (camelCase) to database insert (snake_case)
   */
  toInsert(
    createDto: TransactionCreate,
    userId: string,
    budgetId?: string,
  ): TransactionInsert {
    // Validate with Zod schema - fail fast on invalid data
    const validationResult = transactionCreateSchema.safeParse(createDto);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new BadRequestException(
        `Validation failed: ${firstError.path.join('.')} - ${firstError.message}`,
      );
    }

    const validatedData = validationResult.data;

    // Determine budget ID from multiple sources
    const finalBudgetId = budgetId ?? validatedData.budgetId;

    // Validate that we have a budget ID (required for DB constraint)
    if (!finalBudgetId?.trim()) {
      throw new BadRequestException(
        'Budget ID is required - must be provided either in the DTO or as parameter',
      );
    }

    return {
      budget_id: finalBudgetId,
      amount: createDto.amount,
      type: createDto.type,
      expense_type: createDto.expenseType,
      name: createDto.name,
      description: createDto.description ?? null,
      is_recurring: createDto.isRecurring,
      user_id: userId,
    };
  }

  /**
   * Transform update DTO (camelCase) to database update (snake_case)
   */
  toUpdate(updateDto: TransactionUpdate): Partial<TransactionInsert> {
    const updateData: Partial<TransactionInsert> = {};

    if (updateDto.amount !== undefined) {
      updateData.amount = updateDto.amount;
    }
    if (updateDto.type !== undefined) {
      updateData.type = updateDto.type;
    }
    if (updateDto.expenseType !== undefined) {
      updateData.expense_type = updateDto.expenseType;
    }
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description ?? null;
    }
    if (updateDto.isRecurring !== undefined) {
      updateData.is_recurring = updateDto.isRecurring;
    }

    return updateData;
  }
}
