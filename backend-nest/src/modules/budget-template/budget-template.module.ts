import { Module } from '@nestjs/common';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetTemplateMapper } from './budget-template.mapper';

@Module({
  controllers: [BudgetTemplateController],
  providers: [BudgetTemplateService, BudgetTemplateMapper],
  exports: [BudgetTemplateService],
})
export class BudgetTemplateModule {}