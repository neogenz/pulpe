import { BadRequestException } from '@nestjs/common';
import {
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  transactionCreateSchema,
} from 'pulpe-shared';
import {
  mapCurrencyMetadataToApi,
  mapCurrencyMetadataToDb,
} from '@common/utils/currency-metadata.mapper';
import {
  type TransactionRow,
  type TransactionInsert,
} from './entities/transaction.entity';

/**
 * Transform database row (snake_case) to API entity (camelCase)
 * Expects decrypted transactionDb where amount is already a number
 */
export type DecryptedTransactionRow = Omit<
  TransactionRow,
  'amount' | 'original_amount'
> & {
  amount: number;
  original_amount: number | null;
};

export function toApi(transactionDb: DecryptedTransactionRow): Transaction {
  return {
    id: transactionDb.id,
    createdAt: transactionDb.created_at,
    updatedAt: transactionDb.updated_at,
    budgetId: transactionDb.budget_id,
    budgetLineId: transactionDb.budget_line_id ?? null,
    amount: transactionDb.amount,
    name: transactionDb.name,
    kind: transactionDb.kind, // Pas de conversion - les enums sont maintenant unifiés
    transactionDate: transactionDb.transaction_date,
    category: transactionDb.category,
    checkedAt: transactionDb.checked_at ?? null,
    ...mapCurrencyMetadataToApi(transactionDb),
  };
}

/**
 * Transform multiple database rows to API entities
 * Expects decrypted transactionsDb where amount is already a number
 */
export function toApiList(
  transactionsDb: DecryptedTransactionRow[],
): Transaction[] {
  return transactionsDb.map((transaction) => toApi(transaction));
}

/**
 * Transform create DTO (camelCase) to API preparation (pre-encryption)
 * Note: Amount encryption is handled by the service layer
 */
export function toInsert(
  createDto: TransactionCreate,
  budgetId?: string,
  amountEncrypted?: string,
): TransactionInsert {
  // Validate with Zod schema - fail fast on invalid data
  const validationResult = transactionCreateSchema.safeParse(createDto);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
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
    budget_line_id: createDto.budgetLineId ?? null,
    amount: amountEncrypted ?? null,
    name: createDto.name,
    kind: createDto.kind, // Pas de conversion - les enums sont maintenant unifiés
    transaction_date: createDto.transactionDate || new Date().toISOString(),
    category: createDto.category ?? null,
    ...mapCurrencyMetadataToDb(createDto),
  };
}

/**
 * Transform update DTO (camelCase) to API preparation (pre-encryption)
 * Note: Amount encryption is handled by the service layer
 */
export function toUpdate(
  updateDto: TransactionUpdate,
  amountEncrypted?: string,
): Partial<TransactionInsert> {
  const updateData: Partial<TransactionInsert> = {};

  if (amountEncrypted !== undefined) {
    updateData.amount = amountEncrypted;
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
  if (
    updateDto.originalCurrency !== undefined ||
    updateDto.targetCurrency !== undefined ||
    updateDto.exchangeRate !== undefined
  ) {
    Object.assign(updateData, mapCurrencyMetadataToDb(updateDto));
  }

  return updateData;
}
