import { Module } from '@nestjs/common';
import { BudgetLineController } from './budget-line.controller';
import { BudgetLineService } from './budget-line.service';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { SupabaseBudgetLineRepository } from './infrastructure/persistence/supabase-budget-line.repository';
import { BUDGET_LINE_REPOSITORY } from './domain/ports/budget-line-repository.port';

@Module({
  imports: [SupabaseModule, BudgetModule, EncryptionModule, CurrencyModule],
  controllers: [BudgetLineController],
  providers: [
    BudgetLineService,
    {
      provide: BUDGET_LINE_REPOSITORY,
      useClass: SupabaseBudgetLineRepository,
    },
  ],
  exports: [BudgetLineService],
})
export class BudgetLineModule {}
