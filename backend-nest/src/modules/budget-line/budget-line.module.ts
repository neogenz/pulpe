import { Module } from '@nestjs/common';
import { BudgetLineController } from './budget-line.controller';
import { BudgetLineService } from './budget-line.service';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';

@Module({
  imports: [SupabaseModule, BudgetModule],
  controllers: [BudgetLineController],
  providers: [BudgetLineService],
  exports: [BudgetLineService],
})
export class BudgetLineModule {}
