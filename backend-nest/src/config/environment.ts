import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  DEBUG_HTTP_FULL: z.string().optional(),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(configService: ConfigService): Environment {
  const config = {
    NODE_ENV: configService.get('NODE_ENV', 'development'),
    PORT: configService.get('PORT', 3000),
    SUPABASE_URL: configService.get('SUPABASE_URL'),
    SUPABASE_ANON_KEY: configService.get('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: configService.get('SUPABASE_SERVICE_ROLE_KEY'),
    CORS_ORIGIN: configService.get('CORS_ORIGIN'),
    DEBUG_HTTP_FULL: configService.get('DEBUG_HTTP_FULL'),
  };

  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Environment validation failed:\n${result.error.issues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  return result.data;
}

// Configuration validation function for NestJS ConfigModule
export function validateConfig(config: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Environment validation failed:\n${result.error.issues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  return result.data;
}
