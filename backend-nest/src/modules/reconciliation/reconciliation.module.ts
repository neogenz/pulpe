import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { RECONCILIATION_STATE_REPOSITORY } from './reconciliation.tokens';
import { ReconciliationController } from './infrastructure/http/reconciliation.controller';
import { SupabaseReconciliationStateRepository } from './infrastructure/persistence/supabase-reconciliation-state.repository';
import { GetReconciliationContextUseCase } from './application/get-reconciliation-context.use-case';
import { UpdateReconciliationStateUseCase } from './application/update-reconciliation-state.use-case';

@Module({
  imports: [BudgetModule, SupabaseModule, EncryptionModule],
  controllers: [ReconciliationController],
  providers: [
    GetReconciliationContextUseCase,
    UpdateReconciliationStateUseCase,
    {
      provide: RECONCILIATION_STATE_REPOSITORY,
      useClass: SupabaseReconciliationStateRepository,
    },
    createInfoLoggerProvider(UpdateReconciliationStateUseCase.name),
  ],
})
export class ReconciliationModule {}
