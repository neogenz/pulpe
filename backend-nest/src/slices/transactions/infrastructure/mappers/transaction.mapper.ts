import { Injectable } from '@nestjs/common';
import { Result } from '@/shared/domain/enhanced-result';
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';
import type { Tables } from '@/types/database.types';
import type {
  Transaction as ApiTransaction,
  TransactionCreate,
  TransactionUpdate,
} from '@pulpe/shared';

type TransactionRow = Tables<'transaction'>;

@Injectable()
export class TransactionMapper {
  /**
   * Maps database row to domain entity
   */
  toDomain(row: TransactionRow): Transaction {
    const amountResult = TransactionAmount.create(row.amount);
    if (amountResult.isFail()) {
      throw new Error(`Invalid amount in database: ${row.amount}`);
    }

    const transactionResult = Transaction.create(
      {
        budgetId: row.budget_id,
        amount: amountResult.value,
        name: row.name,
        kind: row.kind,
        transactionDate: new Date(row.transaction_date),
        isOutOfBudget: row.is_out_of_budget,
        category: row.category,
      },
      row.id,
    );

    if (transactionResult.isFail()) {
      throw new Error(
        `Failed to create transaction from database: ${transactionResult.error.message}`,
      );
    }

    return transactionResult.value;
  }

  /**
   * Maps domain entity to database insert/update format
   */
  toDbInsert(
    transaction: Transaction,
  ): Omit<TransactionRow, 'id' | 'created_at' | 'updated_at' | 'user_id'> {
    return {
      budget_id: transaction.budgetId,
      amount: transaction.amount.value,
      name: transaction.name,
      kind: transaction.kind,
      transaction_date: transaction.transactionDate.toISOString(),
      is_out_of_budget: transaction.isOutOfBudget,
      category: transaction.category,
    };
  }

  /**
   * Maps domain entity to API response format
   */
  toApi(transaction: Transaction): ApiTransaction {
    const snapshot = transaction.toSnapshot();
    return {
      id: snapshot.id,
      budgetId: snapshot.budgetId,
      amount: snapshot.amount,
      name: snapshot.name,
      kind: snapshot.kind,
      transactionDate: snapshot.transactionDate.toISOString(),
      isOutOfBudget: snapshot.isOutOfBudget,
      category: snapshot.category,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Maps multiple domain entities to API response format
   */
  toApiList(transactions: Transaction[]): ApiTransaction[] {
    return transactions.map((transaction) => this.toApi(transaction));
  }

  /**
   * Maps create DTO to domain entity props
   */
  fromCreateDto(dto: TransactionCreate) {
    return {
      budgetId: dto.budgetId,
      amount: dto.amount,
      name: dto.name,
      kind: dto.kind,
      transactionDate: dto.transactionDate || new Date().toISOString(),
      isOutOfBudget: dto.isOutOfBudget || false,
      category: dto.category ?? null,
    };
  }

  /**
   * Maps update DTO to partial domain props
   */
  fromUpdateDto(dto: TransactionUpdate) {
    return {
      amount: dto.amount,
      name: dto.name,
      kind: dto.kind,
      transactionDate: dto.transactionDate,
      isOutOfBudget: dto.isOutOfBudget,
      category: dto.category,
    };
  }
}
