import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  transactionCreateSchema,
} from '@pulpe/shared';
import { type TransactionDbEntity } from './schemas/transaction.db.schema';

@Injectable()
export class TransactionMapper {
  /**
   * Valide les données venant de la DB avec Zod
   */
  private parseTransactionRow(dbEntity: unknown): TransactionDbEntity {
    if (!dbEntity || typeof dbEntity !== 'object') {
      throw new InternalServerErrorException('Invalid DB data structure');
    }
    return dbEntity as TransactionDbEntity;
  }

  /**
   * Transforme une entité de la base de données (snake_case) vers le modèle API (camelCase)
   */
  toApi(transactionDb: unknown): Transaction {
    // Validate DB data first - fail fast on corrupted data
    const validatedDb = this.parseTransactionRow(transactionDb);

    return {
      id: validatedDb.id,
      createdAt: validatedDb.created_at,
      updatedAt: validatedDb.updated_at,
      userId: validatedDb.user_id ?? undefined,
      budgetId: validatedDb.budget_id,
      amount: validatedDb.amount,
      type: validatedDb.type,
      expenseType: validatedDb.expense_type,
      name: validatedDb.name,
      description: validatedDb.description ?? undefined,
      isRecurring: validatedDb.is_recurring,
    };
  }

  /**
   * Transforme plusieurs entités DB vers modèles API
   */
  toApiList(transactionsDb: unknown[]): Transaction[] {
    return transactionsDb.map((transaction) => this.toApi(transaction));
  }

  /**
   * Transforme un DTO de création (camelCase) vers format DB (snake_case)
   */
  toDbCreate(
    createDto: TransactionCreate,
    userId: string,
    budgetId?: string,
  ): Omit<TransactionDbEntity, 'id' | 'created_at' | 'updated_at'> {
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
      description: createDto.description ?? null, // Optional field - can have default
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
