import { Module } from '@nestjs/common';
import { BudgetLineController } from './budget-line.controller';
import { BudgetLineService } from './budget-line.service';
import { SupabaseModule } from '@modules/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [BudgetLineController],
  providers: [BudgetLineService],
  exports: [BudgetLineService],
})
export class BudgetLineModule {}
