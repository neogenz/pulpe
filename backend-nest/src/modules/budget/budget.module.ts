import { Module } from '@nestjs/common';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetController } from './infrastructure/http/budget.controller';
import { SupabaseBudgetRepository } from './infrastructure/persistence/supabase-budget.repository';
import { BudgetMapper } from './infrastructure/mappers/budget.mapper';
import { BUDGET_REPOSITORY } from './domain/ports/budget-repository.port';
import { BUDGET_RECALCULATION_PORT } from './domain/ports/budget-recalculation.port';
import { HasBudgetsUseCase } from './application/has-budgets.use-case';
import { FindAllBudgetsUseCase } from './application/find-all-budgets.use-case';
import { FindAllSparseBudgetsUseCase } from './application/find-all-sparse-budgets.use-case';
import { ExportAllBudgetsUseCase } from './application/export-all-budgets.use-case';
import { CreateBudgetUseCase } from './application/create-budget.use-case';
import { GenerateBudgetsUseCase } from './application/generate-budgets.use-case';
import { FindBudgetUseCase } from './application/find-budget.use-case';
import { FindBudgetWithDetailsUseCase } from './application/find-budget-with-details.use-case';
import { UpdateBudgetUseCase } from './application/update-budget.use-case';
import { RemoveBudgetUseCase } from './application/remove-budget.use-case';
import { RecalculateBudgetBalancesUseCase } from './application/recalculate-budget-balances.use-case';

@Module({
  imports: [EncryptionModule],
  controllers: [BudgetController],
  providers: [
    HasBudgetsUseCase,
    FindAllBudgetsUseCase,
    FindAllSparseBudgetsUseCase,
    ExportAllBudgetsUseCase,
    CreateBudgetUseCase,
    GenerateBudgetsUseCase,
    FindBudgetUseCase,
    FindBudgetWithDetailsUseCase,
    UpdateBudgetUseCase,
    RemoveBudgetUseCase,
    RecalculateBudgetBalancesUseCase,
    { provide: BUDGET_REPOSITORY, useClass: SupabaseBudgetRepository },
    {
      provide: BUDGET_RECALCULATION_PORT,
      useExisting: RecalculateBudgetBalancesUseCase,
    },
    BudgetMapper,
    createInfoLoggerProvider(BudgetController.name),
    createInfoLoggerProvider(HasBudgetsUseCase.name),
    createInfoLoggerProvider(FindAllBudgetsUseCase.name),
    createInfoLoggerProvider(FindAllSparseBudgetsUseCase.name),
    createInfoLoggerProvider(ExportAllBudgetsUseCase.name),
    createInfoLoggerProvider(CreateBudgetUseCase.name),
    createInfoLoggerProvider(GenerateBudgetsUseCase.name),
    createInfoLoggerProvider(FindBudgetUseCase.name),
    createInfoLoggerProvider(FindBudgetWithDetailsUseCase.name),
    createInfoLoggerProvider(UpdateBudgetUseCase.name),
    createInfoLoggerProvider(RemoveBudgetUseCase.name),
    createInfoLoggerProvider(RecalculateBudgetBalancesUseCase.name),
    createInfoLoggerProvider(SupabaseBudgetRepository.name),
  ],
  exports: [BUDGET_RECALCULATION_PORT, BudgetMapper],
})
export class BudgetModule {}
