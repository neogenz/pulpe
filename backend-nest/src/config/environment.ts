import { z } from 'zod';
import { SEMVER_PATTERN, isVersionAtMost } from '@common/utils/semver-compare';

const envSchema = z
  .object({
    // No default on purpose: a deployment without NODE_ENV must fail loudly at
    // boot instead of silently running in dev mode (debug endpoints, Swagger,
    // open CORS, relaxed throttles). Every entrypoint sets it explicitly:
    // package.json scripts, Dockerfile, bunfig test preload.
    NODE_ENV: z.enum(['development', 'production', 'preview', 'test']),
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
    // MCP agent connector: the public URL clients present as audience.
    MCP_RESOURCE_URL: z.url().default('http://localhost:3000/mcp'),
    // Phase-1 stand-in for `mcp_connection`: a test vault key and mode.
    MCP_TEST_CLIENT_KEY: z
      .string()
      .length(64)
      .regex(/^[0-9a-f]+$/i)
      .optional(),
    MCP_TEST_ACCESS_MODE: z.enum(['read', 'read_write']).optional(),
    CORS_ORIGIN: z.string().optional(),
    DEBUG_HTTP_FULL: z.string().optional(),
    RAILWAY_ENVIRONMENT_NAME: z.string().optional(),
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
    MIN_IOS_VERSION: z.string().regex(SEMVER_PATTERN).default('1.0.0'),
    // Fallback only: `IosVersionGateService` publishes the version the App
    // Store actually serves and never goes below this value. No `MIN <= LATEST`
    // refine on purpose — the floor is clamped at request time against the
    // downloadable version, so `MIN_IOS_VERSION` can be raised before Apple
    // finishes the rollout instead of crashing the boot.
    LATEST_IOS_VERSION: z.string().regex(SEMVER_PATTERN).default('1.0.0'),
    IOS_STORE_URL: z.url().default('https://apps.apple.com/app/id6758464920'),
    MIN_WEB_VERSION: z.string().regex(SEMVER_PATTERN).default('0.0.1'),
    // No public Play Store lookup counterpart to `IosVersionGateService`, so
    // Android keeps its published version in deployment configuration.
    MIN_ANDROID_VERSION: z.string().regex(SEMVER_PATTERN).default('0.0.1'),
    LATEST_ANDROID_VERSION: z.string().regex(SEMVER_PATTERN).default('0.0.1'),
    ANDROID_STORE_URL: z
      .url()
      .default(
        'https://play.google.com/store/apps/details?id=app.pulpe.android',
      ),
  })
  .strip()
  .refine(
    (env) =>
      isVersionAtMost(env.MIN_ANDROID_VERSION, env.LATEST_ANDROID_VERSION),
    {
      message: 'LATEST_ANDROID_VERSION must be >= MIN_ANDROID_VERSION',
      path: ['LATEST_ANDROID_VERSION'],
    },
  );

export type Environment = z.infer<typeof envSchema>;

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

export const isProductionLike = (
  nodeEnv = process.env.NODE_ENV,
  railwayEnvironmentName = process.env.RAILWAY_ENVIRONMENT_NAME,
): boolean =>
  [nodeEnv, railwayEnvironmentName].some((value) =>
    PRODUCTION_LIKE_ENVIRONMENTS.includes(
      value?.trim().toLowerCase() as ProductionLike,
    ),
  );

interface HttpLoggingEnvironment {
  readonly NODE_ENV?: string;
  readonly DEBUG_HTTP_FULL?: string;
  readonly RAILWAY_ENVIRONMENT_NAME?: string;
}

export interface HttpLoggingDecision {
  readonly mode: 'standard' | 'detailed';
  readonly debugRequested: boolean;
  readonly productionLocked: boolean;
}

export function resolveHttpLoggingDecision(
  environment: HttpLoggingEnvironment,
): HttpLoggingDecision {
  const debugRequested =
    environment.DEBUG_HTTP_FULL?.trim().toLowerCase() === 'true';
  const productionLocked = [
    environment.NODE_ENV,
    environment.RAILWAY_ENVIRONMENT_NAME,
  ].some((value) => value?.trim().toLowerCase() === 'production');
  const supportsDetailedLogs =
    environment.NODE_ENV === 'development' ||
    environment.NODE_ENV === 'preview';

  return {
    mode:
      debugRequested && supportsDetailedLogs && !productionLocked
        ? 'detailed'
        : 'standard',
    debugRequested,
    productionLocked: debugRequested && productionLocked,
  };
}
