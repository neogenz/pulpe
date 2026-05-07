import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';

@Injectable()
export class ToggleBudgetLineCheckUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(ToggleBudgetLineCheckUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    const row = await this.repo.toggleCheckRpc(id, supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        operation: 'budgetLine.toggleCheck',
      },
      'Budget line check toggled',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }
}
