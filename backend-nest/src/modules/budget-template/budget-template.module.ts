import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetModule } from '@modules/budget/budget.module';
import { CurrencyModule } from '@modules/currency/currency.module';

@Module({
  imports: [BudgetModule, CurrencyModule],
  controllers: [BudgetTemplateController],
  providers: [
    BudgetTemplateService,
    createInfoLoggerProvider(BudgetTemplateService.name),
  ],
})
export class BudgetTemplateModule {}
