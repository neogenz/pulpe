import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineListResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';

@Injectable()
export class FindBudgetLinesByBudgetUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(FindBudgetLinesByBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineListResponse> {
    const rows = await this.repo.findByBudgetId(budgetId, supabase);
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = rows.map((row) =>
      this.encryption.decryptRowAmountFields(row, dek),
    );

    this.logger.info(
      {
        userId: user.id,
        budgetId,
        count: decrypted.length,
        operation: 'budgetLine.findByBudget',
      },
      'Budget lines by budget fetched',
    );

    return { success: true as const, data: this.mapper.toApiList(decrypted) };
  }
}
