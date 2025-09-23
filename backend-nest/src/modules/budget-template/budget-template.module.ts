import { Module } from '@nestjs/common';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetModule } from '@modules/budget/budget.module';

@Module({
  imports: [BudgetModule],
  controllers: [BudgetTemplateController],
  providers: [BudgetTemplateService],
})
export class BudgetTemplateModule {}
