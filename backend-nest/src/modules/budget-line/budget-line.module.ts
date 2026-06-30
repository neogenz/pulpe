import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetLineController } from './infrastructure/http/budget-line.controller';
import { SupabaseBudgetLineRepository } from './infrastructure/persistence/supabase-budget-line.repository';
import { BudgetLineMapper } from './infrastructure/mappers/budget-line.mapper';
import { BUDGET_LINE_REPOSITORY } from './domain/ports/budget-line-repository.port';
import { BUDGET_LINE_SPREAD_PORT } from './domain/ports/budget-line-spread.port';
import {
  BUDGET_LINE_CHECK_TRANSACTIONS_PORT,
  BUDGET_LINE_SPREAD_OCCURRENCES_PORT,
} from './domain/ports/budget-line-allocation.port';
import { FindAllBudgetLinesUseCase } from './application/find-all-budget-lines.use-case';
import { FindBudgetLineUseCase } from './application/find-budget-line.use-case';
import { FindBudgetLinesByBudgetUseCase } from './application/find-budget-lines-by-budget.use-case';
import { CreateBudgetLineUseCase } from './application/create-budget-line.use-case';
import { CreateBudgetLineSpreadUseCase } from './application/create-budget-line-spread.use-case';
import { SpreadBudgetLineFromLineUseCase } from './application/spread-budget-line-from-line.use-case';
import { FindBudgetLinesBySpreadGroupUseCase } from './application/find-budget-lines-by-spread-group.use-case';
import { UpdateBudgetLineUseCase } from './application/update-budget-line.use-case';
import { RemoveBudgetLineUseCase } from './application/remove-budget-line.use-case';
import { ResetBudgetLineFromTemplateUseCase } from './application/reset-budget-line-from-template.use-case';
import { ToggleBudgetLineCheckUseCase } from './application/toggle-budget-line-check.use-case';
import { CheckTransactionsUseCase } from './application/check-transactions.use-case';
import { PostponeBudgetLineUseCase } from './application/postpone-budget-line.use-case';

@Module({
  imports: [
    SupabaseModule,
    BudgetModule,
    BudgetTemplateModule,
    EncryptionModule,
    CurrencyModule,
  ],
  controllers: [BudgetLineController],
  providers: [
    FindAllBudgetLinesUseCase,
    FindBudgetLineUseCase,
    FindBudgetLinesByBudgetUseCase,
    CreateBudgetLineUseCase,
    CreateBudgetLineSpreadUseCase,
    SpreadBudgetLineFromLineUseCase,
    FindBudgetLinesBySpreadGroupUseCase,
    UpdateBudgetLineUseCase,
    RemoveBudgetLineUseCase,
    ResetBudgetLineFromTemplateUseCase,
    ToggleBudgetLineCheckUseCase,
    CheckTransactionsUseCase,
    PostponeBudgetLineUseCase,
    { provide: BUDGET_LINE_REPOSITORY, useClass: SupabaseBudgetLineRepository },
    {
      provide: BUDGET_LINE_SPREAD_PORT,
      useExisting: CreateBudgetLineSpreadUseCase,
    },
    {
      provide: BUDGET_LINE_SPREAD_OCCURRENCES_PORT,
      useExisting: FindBudgetLinesBySpreadGroupUseCase,
    },
    {
      provide: BUDGET_LINE_CHECK_TRANSACTIONS_PORT,
      useExisting: CheckTransactionsUseCase,
    },
    BudgetLineMapper,
    createInfoLoggerProvider(BudgetLineController.name),
    createInfoLoggerProvider(FindAllBudgetLinesUseCase.name),
    createInfoLoggerProvider(FindBudgetLineUseCase.name),
    createInfoLoggerProvider(FindBudgetLinesByBudgetUseCase.name),
    createInfoLoggerProvider(CreateBudgetLineUseCase.name),
    createInfoLoggerProvider(CreateBudgetLineSpreadUseCase.name),
    createInfoLoggerProvider(SpreadBudgetLineFromLineUseCase.name),
    createInfoLoggerProvider(FindBudgetLinesBySpreadGroupUseCase.name),
    createInfoLoggerProvider(UpdateBudgetLineUseCase.name),
    createInfoLoggerProvider(RemoveBudgetLineUseCase.name),
    createInfoLoggerProvider(ResetBudgetLineFromTemplateUseCase.name),
    createInfoLoggerProvider(ToggleBudgetLineCheckUseCase.name),
    createInfoLoggerProvider(CheckTransactionsUseCase.name),
    createInfoLoggerProvider(PostponeBudgetLineUseCase.name),
  ],
  exports: [
    BUDGET_LINE_SPREAD_PORT,
    BUDGET_LINE_SPREAD_OCCURRENCES_PORT,
    BUDGET_LINE_CHECK_TRANSACTIONS_PORT,
  ],
})
export class BudgetLineModule {}
