import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateInvariants } from '../domain/budget-template.invariants';
import type {
  TemplateLine,
  TemplateLineRpcInput,
  TemplateWithLines,
} from '../domain/budget-template.entity';

/**
 * Copies a template and every line, tags included, under a new name. The copy
 * is never the default. It copies at repository level on purpose: each line
 * keeps its historical FX rate, which the create path would re-fetch.
 */
@Injectable()
export class DuplicateTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(DuplicateTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    sourceId: string,
    name: string,
    user: AuthenticatedUser,
  ): Promise<TemplateWithLines> {
    const startTime = Date.now();

    const source = await this.repo.validateAccess(sourceId, user.id);
    BudgetTemplateInvariants.validateTemplateLimit(
      await this.repo.countForUser(user.id),
    );
    const sourceLines = await this.repo.findLinesByTemplateId(sourceId);

    const template = await this.repo.createTemplateWithLines({
      userId: user.id,
      name,
      description: source.description ?? undefined,
      isDefault: false,
      lines: sourceLines.map((line) => this.toRpcInput(line)),
    });
    const lines = await this.repo.findLinesByTemplateId(template.id);

    this.logger.info(
      {
        operation: 'duplicate',
        userId: user.id,
        entityId: template.id,
        sourceId,
        duration: Date.now() - startTime,
      },
      'Template duplicated successfully',
    );

    return { template, lines };
  }

  private toRpcInput(line: TemplateLine): TemplateLineRpcInput {
    return {
      name: line.name,
      amount: line.amount,
      kind: line.kind,
      recurrence: line.recurrence,
      savingsGoalId: line.savingsGoalId,
      tagIds: line.tagIds,
      description: line.description ?? '',
      originalAmount: line.originalAmount,
      originalCurrency: line.originalCurrency,
      targetCurrency: line.targetCurrency,
      exchangeRate: line.exchangeRate,
    };
  }
}
