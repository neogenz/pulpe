import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineListResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';

@Injectable()
export class FindAllBudgetLinesUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(FindAllBudgetLinesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineListResponse> {
    const rows = await this.repo.findAll(supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = rows.map((row) =>
      this.encryptionService.decryptRowAmountFields(row, dek),
    );

    this.logger.info(
      {
        userId: user.id,
        count: decrypted.length,
        operation: 'budgetLine.findAll',
      },
      'Budget lines fetched',
    );

    return { success: true as const, data: this.mapper.toApiList(decrypted) };
  }
}
