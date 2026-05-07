import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetModule } from '@modules/budget/budget.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { SupabaseBudgetTemplateRepository } from './infrastructure/persistence/supabase-budget-template.repository';
import { BudgetTemplateMapper } from './infrastructure/mappers/budget-template.mapper';
import { BUDGET_TEMPLATE_REPOSITORY } from './domain/ports/budget-template-repository.port';

@Module({
  imports: [BudgetModule, CurrencyModule],
  controllers: [BudgetTemplateController],
  providers: [
    BudgetTemplateService,
    BudgetTemplateMapper,
    {
      provide: BUDGET_TEMPLATE_REPOSITORY,
      useClass: SupabaseBudgetTemplateRepository,
    },
    createInfoLoggerProvider(BudgetTemplateService.name),
    createInfoLoggerProvider(SupabaseBudgetTemplateRepository.name),
  ],
})
export class BudgetTemplateModule {}
