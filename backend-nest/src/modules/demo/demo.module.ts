import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { createInfoLoggerProvider } from '@common/logger';
import { DevOnlyGuard } from '@common/guards/dev-only.guard';
import { DemoController } from './infrastructure/http/demo.controller';
import { SupabaseDemoRepository } from './infrastructure/persistence/supabase-demo.repository';
import { SupabaseDemoCredentialsAdapter } from './infrastructure/auth/supabase-demo-credentials.adapter';
import { DemoCleanupCron } from './infrastructure/scheduler/demo-cleanup.cron';
import { CreateDemoSessionUseCase } from './application/create-demo-session.use-case';
import { GenerateDemoDataUseCase } from './application/generate-demo-data.use-case';
import { CleanupExpiredDemoUsersUseCase } from './application/cleanup-expired-demo-users.use-case';
import { CleanupDemoUsersByAgeUseCase } from './application/cleanup-demo-users-by-age.use-case';
import { DEMO_CREDENTIALS_PORT } from './domain/ports/demo-credentials.port';
import { DEMO_REPOSITORY } from './domain/ports/demo-repository.port';

@Module({
  imports: [
    SupabaseModule,
    BudgetTemplateModule,
    BudgetModule,
    EncryptionModule,
  ],
  controllers: [DemoController],
  providers: [
    CreateDemoSessionUseCase,
    GenerateDemoDataUseCase,
    CleanupExpiredDemoUsersUseCase,
    CleanupDemoUsersByAgeUseCase,
    DemoCleanupCron,
    DevOnlyGuard,
    {
      provide: DEMO_CREDENTIALS_PORT,
      useClass: SupabaseDemoCredentialsAdapter,
    },
    { provide: DEMO_REPOSITORY, useClass: SupabaseDemoRepository },
    createInfoLoggerProvider(DemoController.name),
    createInfoLoggerProvider(CreateDemoSessionUseCase.name),
    createInfoLoggerProvider(GenerateDemoDataUseCase.name),
    createInfoLoggerProvider(CleanupExpiredDemoUsersUseCase.name),
    createInfoLoggerProvider(CleanupDemoUsersByAgeUseCase.name),
    createInfoLoggerProvider(SupabaseDemoCredentialsAdapter.name),
  ],
  exports: [CreateDemoSessionUseCase, CleanupDemoUsersByAgeUseCase],
})
export class DemoModule {}
