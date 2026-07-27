import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { createInfoLoggerProvider } from '@common/logger';
import { SavingsGoalController } from './infrastructure/http/savings-goal.controller';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';
import { SavingsGoalMapper } from './infrastructure/mappers/savings-goal.mapper';
import { SAVINGS_GOAL_REPOSITORY } from './domain/ports/savings-goal-repository.port';
import { FindAllSavingsGoalsUseCase } from './application/find-all-savings-goals.use-case';
import { FindSavingsGoalUseCase } from './application/find-savings-goal.use-case';
import { CreateSavingsGoalUseCase } from './application/create-savings-goal.use-case';
import { UpdateSavingsGoalUseCase } from './application/update-savings-goal.use-case';
import { RemoveSavingsGoalUseCase } from './application/remove-savings-goal.use-case';
import { GetSavingsGoalProgressUseCase } from './application/get-savings-goal-progress.use-case';
import { GetSavingsGoalContributionsUseCase } from './application/get-savings-goal-contributions.use-case';
import { ApplySavingsGoalPlanUseCase } from './application/apply-savings-goal-plan.use-case';
import { GetSavingsGoalFutureLinesUseCase } from './application/get-savings-goal-future-lines.use-case';
import { ApplySavingsGoalGenerationStopUseCase } from './application/apply-savings-goal-generation-stop.use-case';
import { GetSavingsGoalDeletionImpactUseCase } from './application/get-savings-goal-deletion-impact.use-case';

@Module({
  // BudgetModule provides BUDGET_RECALCULATION_PORT (plan apply recalculates the
  // touched budgets); BudgetLineModule provides BUDGET_LINE_SPREAD_PORT, which
  // materializes a dated goal as bounded linked forecasts (PUL-316).
  // CacheService is @Global — no import needed.
  imports: [
    SupabaseModule,
    EncryptionModule,
    BudgetModule,
    BudgetLineModule,
    BudgetTemplateModule,
  ],
  controllers: [SavingsGoalController],
  providers: [
    FindAllSavingsGoalsUseCase,
    FindSavingsGoalUseCase,
    CreateSavingsGoalUseCase,
    UpdateSavingsGoalUseCase,
    RemoveSavingsGoalUseCase,
    GetSavingsGoalProgressUseCase,
    GetSavingsGoalContributionsUseCase,
    ApplySavingsGoalPlanUseCase,
    GetSavingsGoalFutureLinesUseCase,
    ApplySavingsGoalGenerationStopUseCase,
    GetSavingsGoalDeletionImpactUseCase,
    {
      provide: SAVINGS_GOAL_REPOSITORY,
      useClass: SupabaseSavingsGoalRepository,
    },
    SavingsGoalMapper,
    createInfoLoggerProvider(FindAllSavingsGoalsUseCase.name),
    createInfoLoggerProvider(FindSavingsGoalUseCase.name),
    createInfoLoggerProvider(CreateSavingsGoalUseCase.name),
    createInfoLoggerProvider(UpdateSavingsGoalUseCase.name),
    createInfoLoggerProvider(RemoveSavingsGoalUseCase.name),
    createInfoLoggerProvider(GetSavingsGoalProgressUseCase.name),
    createInfoLoggerProvider(GetSavingsGoalContributionsUseCase.name),
    createInfoLoggerProvider(ApplySavingsGoalPlanUseCase.name),
    createInfoLoggerProvider(ApplySavingsGoalGenerationStopUseCase.name),
    createInfoLoggerProvider(GetSavingsGoalDeletionImpactUseCase.name),
  ],
  exports: [],
})
export class SavingsGoalModule {}
