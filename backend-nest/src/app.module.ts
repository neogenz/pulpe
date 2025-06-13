import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Modules
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { DebugModule } from '@modules/debug/debug.module';

// Middleware
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    SupabaseModule,
    AuthModule,
    BudgetModule,
    TransactionModule,
    UserModule,
    DebugModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*');
  }
}