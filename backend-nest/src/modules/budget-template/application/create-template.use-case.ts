import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
  budgetTemplateCreateSchema,
} from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CurrencyService } from '@modules/currency/currency.service';
import { type Database } from '@/types/database.types';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateInvariants } from '../domain/budget-template.invariants';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';
import { createTemplateLinesRpcPayloadSchema } from '../infrastructure/persistence/schemas/rpc-payload.schemas';

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly currencyService: CurrencyService,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(CreateTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    createDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetTemplateCreateResponse> {
    const startTime = Date.now();

    const validated = budgetTemplateCreateSchema.parse(createDto);

    const count = await this.repo.countForUser(user.id);
    BudgetTemplateInvariants.validateTemplateLimit(count);

    if (validated.isDefault) {
      await this.repo.resetDefaultTemplates(user.id, null);
    }

    const template = await this.createTemplateWithRpc(validated, user);

    const lines = await this.repo.findLinesByTemplateId(template.id);
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decryptedLines = lines.map((l) =>
      this.mapper.decryptLine(l, this.encryption, dek),
    );

    this.logger.info(
      {
        operation: 'create',
        userId: user.id,
        entityId: template.id,
        duration: Date.now() - startTime,
      },
      'Template created successfully',
    );

    return {
      success: true,
      data: {
        template: this.mapper.toApiTemplate(template),
        lines: this.mapper.toApiTemplateLineList(decryptedLines),
      },
    };
  }

  private async createTemplateWithRpc(
    validated: BudgetTemplateCreate,
    user: AuthenticatedUser,
  ) {
    const overriddenLines = await Promise.all(
      validated.lines.map((line) =>
        this.currencyService.overrideExchangeRate(line),
      ),
    );

    const amounts = overriddenLines.map((line) => line.amount);
    const [preparedAmounts, encryptedOriginalAmounts] = await Promise.all([
      this.encryption.prepareAmountsData(amounts, user.id, user.clientKey),
      Promise.all(
        overriddenLines.map((line) =>
          this.encryption.encryptOptionalAmount(
            line.originalAmount,
            user.id,
            user.clientKey,
          ),
        ),
      ),
    ]);

    const rpcLines = overriddenLines.map((line, index) => ({
      name: line.name,
      amount: preparedAmounts[index].amount,
      kind: line.kind as Database['public']['Enums']['transaction_kind'],
      recurrence:
        line.recurrence as Database['public']['Enums']['transaction_recurrence'],
      description: line.description || '',
      original_amount: encryptedOriginalAmounts[index],
      original_currency: line.originalCurrency ?? null,
      target_currency: line.targetCurrency ?? null,
      exchange_rate: line.exchangeRate ?? null,
    }));

    const validatedRpcLines =
      createTemplateLinesRpcPayloadSchema.parse(rpcLines);

    return this.repo.createTemplateWithLinesRpc({
      p_user_id: user.id,
      p_name: validated.name,
      p_description: validated.description,
      p_is_default: validated.isDefault || false,
      p_lines: validatedRpcLines,
    });
  }
}
