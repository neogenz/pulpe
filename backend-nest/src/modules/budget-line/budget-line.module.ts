import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetLineController } from './infrastructure/http/budget-line.controller';
import { SupabaseBudgetLineRepository } from './infrastructure/persistence/supabase-budget-line.repository';
import { BudgetLineMapper } from './infrastructure/mappers/budget-line.mapper';
import { BUDGET_LINE_REPOSITORY } from './domain/ports/budget-line-repository.port';
import { FindAllBudgetLinesUseCase } from './application/find-all-budget-lines.use-case';
import { FindBudgetLineUseCase } from './application/find-budget-line.use-case';
import { FindBudgetLinesByBudgetUseCase } from './application/find-budget-lines-by-budget.use-case';
import { CreateBudgetLineUseCase } from './application/create-budget-line.use-case';
import { UpdateBudgetLineUseCase } from './application/update-budget-line.use-case';
import { RemoveBudgetLineUseCase } from './application/remove-budget-line.use-case';
import { ResetBudgetLineFromTemplateUseCase } from './application/reset-budget-line-from-template.use-case';
import { ToggleBudgetLineCheckUseCase } from './application/toggle-budget-line-check.use-case';
import { CheckTransactionsUseCase } from './application/check-transactions.use-case';

@Module({
  imports: [
    SupabaseModule,
    BudgetModule,
    EncryptionModule,
    CurrencyModule,
    TransactionModule,
  ],
  controllers: [BudgetLineController],
  providers: [
    FindAllBudgetLinesUseCase,
    FindBudgetLineUseCase,
    FindBudgetLinesByBudgetUseCase,
    CreateBudgetLineUseCase,
    UpdateBudgetLineUseCase,
    RemoveBudgetLineUseCase,
    ResetBudgetLineFromTemplateUseCase,
    ToggleBudgetLineCheckUseCase,
    CheckTransactionsUseCase,
    { provide: BUDGET_LINE_REPOSITORY, useClass: SupabaseBudgetLineRepository },
    BudgetLineMapper,
    createInfoLoggerProvider(BudgetLineController.name),
    createInfoLoggerProvider(FindAllBudgetLinesUseCase.name),
    createInfoLoggerProvider(FindBudgetLineUseCase.name),
    createInfoLoggerProvider(FindBudgetLinesByBudgetUseCase.name),
    createInfoLoggerProvider(CreateBudgetLineUseCase.name),
    createInfoLoggerProvider(UpdateBudgetLineUseCase.name),
    createInfoLoggerProvider(RemoveBudgetLineUseCase.name),
    createInfoLoggerProvider(ResetBudgetLineFromTemplateUseCase.name),
    createInfoLoggerProvider(ToggleBudgetLineCheckUseCase.name),
    createInfoLoggerProvider(CheckTransactionsUseCase.name),
  ],
  exports: [],
})
export class BudgetLineModule {}
