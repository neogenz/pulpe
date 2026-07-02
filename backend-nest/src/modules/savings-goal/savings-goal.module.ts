import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
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

@Module({
  imports: [SupabaseModule, EncryptionModule],
  controllers: [SavingsGoalController],
  providers: [
    FindAllSavingsGoalsUseCase,
    FindSavingsGoalUseCase,
    CreateSavingsGoalUseCase,
    UpdateSavingsGoalUseCase,
    RemoveSavingsGoalUseCase,
    {
      provide: SAVINGS_GOAL_REPOSITORY,
      useClass: SupabaseSavingsGoalRepository,
    },
    SavingsGoalMapper,
    createInfoLoggerProvider(SavingsGoalController.name),
    createInfoLoggerProvider(FindAllSavingsGoalsUseCase.name),
    createInfoLoggerProvider(FindSavingsGoalUseCase.name),
    createInfoLoggerProvider(CreateSavingsGoalUseCase.name),
    createInfoLoggerProvider(UpdateSavingsGoalUseCase.name),
    createInfoLoggerProvider(RemoveSavingsGoalUseCase.name),
  ],
  exports: [],
})
export class SavingsGoalModule {}
