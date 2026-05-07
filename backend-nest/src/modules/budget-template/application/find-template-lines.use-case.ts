import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLineListResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class FindTemplateLinesUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(FindTemplateLinesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLineListResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);
    const lines = await this.repo.findLinesByTemplateId(templateId);

    if (!lines.length) {
      return {
        success: true,
        data: [],
      };
    }

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decryptedLines = lines.map((l) =>
      this.mapper.decryptLine(l, this.encryption, dek),
    );

    this.logger.info(
      {
        operation: 'findTemplateLines',
        userId: user.id,
        entityId: templateId,
        duration: Date.now() - startTime,
        lineCount: decryptedLines.length,
      },
      'Template lines retrieved successfully',
    );

    return {
      success: true,
      data: this.mapper.toApiTemplateLineList(decryptedLines),
    };
  }
}
