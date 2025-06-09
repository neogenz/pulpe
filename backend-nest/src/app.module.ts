import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Modules
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';

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
  ],
})
export class AppModule {}