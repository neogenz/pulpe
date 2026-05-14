import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'preview', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z.string().min(1, { error: 'SUPABASE_URL is required' }),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_ANON_KEY is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  TURNSTILE_SECRET_KEY: z
    .string()
    .min(1, { error: 'TURNSTILE_SECRET_KEY is required' }),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .length(64, {
      error:
        'ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes)',
    })
    .regex(/^[0-9a-f]+$/i, {
      error: 'ENCRYPTION_MASTER_KEY must be a valid hex string',
    }),
  CORS_ORIGIN: z.string().optional(),
  DEBUG_HTTP_FULL: z.string().optional(),
  MAINTENANCE_MODE: z.string().optional(),
  IP_BLACKLIST: z.string().optional(),

  // PostHog person deletion (RGPD Art. 17). Requires a Personal API Key
  // with `person:write` scope — NOT a project key (PostHog rejects project
  // keys for person deletion).
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_PROJECT_ID: z
    .string()
    .regex(/^\d+$/, {
      error: 'POSTHOG_PROJECT_ID must be a positive integer',
    })
    .optional(),
  POSTHOG_HOST: z
    .string()
    .regex(/^https:\/\/[^/]+$/, {
      error:
        'POSTHOG_HOST must be HTTPS with no trailing slash or path (e.g. https://eu.posthog.com)',
    })
    .optional(),

  // Force-update gate (consumed by GET /api/v1/app/version)
  MIN_IOS_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('1.0.0'),
  LATEST_IOS_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('1.0.0'),
  IOS_STORE_URL: z.url().default('https://apps.apple.com/app/id6758464920'),
  MIN_WEB_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('0.0.1'),
  LATEST_WEB_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('0.0.1'),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(configService: ConfigService): Environment {
  const config = {
    NODE_ENV: configService.get('NODE_ENV', 'development'),
    PORT: configService.get('PORT', 3000),
    SUPABASE_URL: configService.get('SUPABASE_URL'),
    SUPABASE_ANON_KEY: configService.get('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: configService.get('SUPABASE_SERVICE_ROLE_KEY'),
    TURNSTILE_SECRET_KEY: configService.get('TURNSTILE_SECRET_KEY'),
    ENCRYPTION_MASTER_KEY: configService.get('ENCRYPTION_MASTER_KEY'),
    CORS_ORIGIN: configService.get('CORS_ORIGIN'),
    DEBUG_HTTP_FULL: configService.get('DEBUG_HTTP_FULL'),
    MAINTENANCE_MODE: configService.get('MAINTENANCE_MODE'),
    IP_BLACKLIST: configService.get('IP_BLACKLIST'),
    POSTHOG_API_KEY: configService.get('POSTHOG_API_KEY'),
    POSTHOG_PROJECT_ID: configService.get('POSTHOG_PROJECT_ID'),
    POSTHOG_HOST: configService.get('POSTHOG_HOST'),
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

const PRODUCTION_LIKE_ENVIRONMENTS = ['production', 'preview'] as const;

type ProductionLike = (typeof PRODUCTION_LIKE_ENVIRONMENTS)[number];

export const isProductionLike = (value?: string): boolean => {
  const candidate = value ?? process.env.NODE_ENV ?? '';
  return PRODUCTION_LIKE_ENVIRONMENTS.includes(candidate as ProductionLike);
};
