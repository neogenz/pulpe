import { Module } from '@nestjs/common';
import { BudgetLineController } from './budget-line.controller';
import { BudgetLineService } from './budget-line.service';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { CurrencyModule } from '@modules/currency/currency.module';

@Module({
  imports: [SupabaseModule, BudgetModule, EncryptionModule, CurrencyModule],
  controllers: [BudgetLineController],
  providers: [BudgetLineService],
  exports: [BudgetLineService],
})
export class BudgetLineModule {}
