import { Module } from '@nestjs/common';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';

@Module({
  controllers: [BudgetTemplateController],
  providers: [BudgetTemplateService],
})
export class BudgetTemplateModule {}
