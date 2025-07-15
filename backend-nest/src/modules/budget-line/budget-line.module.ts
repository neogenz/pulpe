import { Module } from '@nestjs/common';
import { BudgetLineController } from './budget-line.controller';
import { BudgetLineService } from './budget-line.service';
import { BudgetLineMapper } from './budget-line.mapper';
import { SupabaseModule } from '@modules/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [BudgetLineController],
  providers: [BudgetLineService, BudgetLineMapper],
  exports: [BudgetLineService, BudgetLineMapper],
})
export class BudgetLineModule {}
