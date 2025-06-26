import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';

@Module({
  controllers: [BudgetController],
  providers: [BudgetService, BudgetMapper],
})
export class BudgetModule {}
