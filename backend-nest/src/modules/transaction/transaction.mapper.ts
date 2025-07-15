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
      budgetId: transactionDb.budget_id,
      amount: transactionDb.amount,
      name: transactionDb.name,
      kind: transactionDb.kind,
      transactionDate: transactionDb.transaction_date,
      isOutOfBudget: transactionDb.is_out_of_budget,
      category: transactionDb.category,
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
  toInsert(createDto: TransactionCreate, budgetId?: string): TransactionInsert {
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
      name: createDto.name,
      kind: createDto.kind,
      transaction_date: createDto.transactionDate || new Date().toISOString(),
      is_out_of_budget: createDto.isOutOfBudget || false,
      category: createDto.category ?? null,
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
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.kind !== undefined) {
      updateData.kind = updateDto.kind;
    }
    if (updateDto.transactionDate !== undefined) {
      updateData.transaction_date = updateDto.transactionDate;
    }
    if (updateDto.isOutOfBudget !== undefined) {
      updateData.is_out_of_budget = updateDto.isOutOfBudget;
    }
    if (updateDto.category !== undefined) {
      updateData.category = updateDto.category;
    }

    return updateData;
  }
}
