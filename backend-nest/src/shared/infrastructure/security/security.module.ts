import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityConfig } from './security.config';
import { EnhancedAuthGuard } from './enhanced-auth.guard';
import { SupabaseModule } from '../../../modules/supabase/supabase.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = configService.get<number>('RATE_LIMIT_TTL', 60000);
        const limit = configService.get<number>('RATE_LIMIT_MAX', 100);

        return [
          {
            ttl,
            limit,
          },
        ];
      },
    }),
  ],
  providers: [
    SecurityConfig,
    // Global auth guard - can be overridden with @Public() decorator
    {
      provide: APP_GUARD,
      useClass: EnhancedAuthGuard,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [SecurityConfig],
})
export class SecurityModule {}
