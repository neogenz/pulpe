import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';

@Injectable()
export class FindBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(FindBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    const row = await this.repo.findById(id, supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    this.logger.info(
      { userId: user.id, budgetLineId: id, operation: 'budgetLine.findOne' },
      'Budget line fetched',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }
}
