import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetTemplateController } from './infrastructure/http/budget-template.controller';
import { BudgetModule } from '@modules/budget/budget.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { SupabaseBudgetTemplateRepository } from './infrastructure/persistence/supabase-budget-template.repository';
import { BudgetTemplateMapper } from './infrastructure/mappers/budget-template.mapper';
import { BUDGET_TEMPLATE_REPOSITORY } from './domain/ports/budget-template-repository.port';
import { FindAllTemplatesUseCase } from './application/find-all-templates.use-case';
import { FindTemplateUseCase } from './application/find-template.use-case';
import { CreateTemplateUseCase } from './application/create-template.use-case';
import { CreateTemplateFromOnboardingUseCase } from './application/create-template-from-onboarding.use-case';
import { UpdateTemplateUseCase } from './application/update-template.use-case';
import { RemoveTemplateUseCase } from './application/remove-template.use-case';
import { CheckTemplateUsageUseCase } from './application/check-template-usage.use-case';
import { FindTemplateLinesUseCase } from './application/find-template-lines.use-case';
import { FindTemplateLineUseCase } from './application/find-template-line.use-case';
import { CreateTemplateLineUseCase } from './application/create-template-line.use-case';
import { UpdateTemplateLineUseCase } from './application/update-template-line.use-case';
import { DeleteTemplateLineUseCase } from './application/delete-template-line.use-case';
import { BulkTemplateLineOperationsUseCase } from './application/bulk-template-line-operations.use-case';

@Module({
  imports: [BudgetModule, CurrencyModule],
  controllers: [BudgetTemplateController],
  providers: [
    BudgetTemplateMapper,
    {
      provide: BUDGET_TEMPLATE_REPOSITORY,
      useClass: SupabaseBudgetTemplateRepository,
    },
    FindAllTemplatesUseCase,
    FindTemplateUseCase,
    CreateTemplateUseCase,
    CreateTemplateFromOnboardingUseCase,
    UpdateTemplateUseCase,
    RemoveTemplateUseCase,
    CheckTemplateUsageUseCase,
    FindTemplateLinesUseCase,
    FindTemplateLineUseCase,
    CreateTemplateLineUseCase,
    UpdateTemplateLineUseCase,
    DeleteTemplateLineUseCase,
    BulkTemplateLineOperationsUseCase,
    createInfoLoggerProvider(SupabaseBudgetTemplateRepository.name),
    createInfoLoggerProvider(FindAllTemplatesUseCase.name),
    createInfoLoggerProvider(FindTemplateUseCase.name),
    createInfoLoggerProvider(CreateTemplateUseCase.name),
    createInfoLoggerProvider(CreateTemplateFromOnboardingUseCase.name),
    createInfoLoggerProvider(UpdateTemplateUseCase.name),
    createInfoLoggerProvider(RemoveTemplateUseCase.name),
    createInfoLoggerProvider(CheckTemplateUsageUseCase.name),
    createInfoLoggerProvider(FindTemplateLinesUseCase.name),
    createInfoLoggerProvider(FindTemplateLineUseCase.name),
    createInfoLoggerProvider(CreateTemplateLineUseCase.name),
    createInfoLoggerProvider(UpdateTemplateLineUseCase.name),
    createInfoLoggerProvider(DeleteTemplateLineUseCase.name),
    createInfoLoggerProvider(BulkTemplateLineOperationsUseCase.name),
  ],
})
export class BudgetTemplateModule {}
