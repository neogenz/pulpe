import { BadRequestException } from '@nestjs/common';
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

/**
 * Transform database row (snake_case) to API entity (camelCase)
 */
export function toApi(transactionDb: TransactionRow): Transaction {
  return {
    id: transactionDb.id,
    createdAt: transactionDb.created_at,
    updatedAt: transactionDb.updated_at,
    budgetId: transactionDb.budget_id,
    amount: transactionDb.amount,
    name: transactionDb.name,
    kind: transactionDb.kind, // Pas de conversion - les enums sont maintenant unifiés
    transactionDate: transactionDb.transaction_date,
    category: transactionDb.category,
  };
}

/**
 * Transform multiple database rows to API entities
 */
export function toApiList(transactionsDb: TransactionRow[]): Transaction[] {
  return transactionsDb.map((transaction) => toApi(transaction));
}

/**
 * Transform create DTO (camelCase) to database insert (snake_case)
 */
export function toInsert(
  createDto: TransactionCreate,
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
    name: createDto.name,
    kind: createDto.kind, // Pas de conversion - les enums sont maintenant unifiés
    transaction_date: createDto.transactionDate || new Date().toISOString(),
    category: createDto.category ?? null,
  };
}

/**
 * Transform update DTO (camelCase) to database update (snake_case)
 */
export function toUpdate(
  updateDto: TransactionUpdate,
): Partial<TransactionInsert> {
  const updateData: Partial<TransactionInsert> = {};

  if (updateDto.amount !== undefined) {
    updateData.amount = updateDto.amount;
  }
  if (updateDto.name !== undefined) {
    updateData.name = updateDto.name;
  }
  if (updateDto.kind !== undefined) {
    updateData.kind = updateDto.kind; // Pas de conversion - les enums sont maintenant unifiés
  }
  if (updateDto.transactionDate !== undefined) {
    updateData.transaction_date = updateDto.transactionDate;
  }
  if (updateDto.category !== undefined) {
    updateData.category = updateDto.category;
  }

  return updateData;
}
