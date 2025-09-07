import { z } from 'zod';

/**
 * Zod schema for runtime configuration validation.
 * This schema defines the structure and validation rules for config.json
 */
export const ConfigSchema = z.object({
  supabase: z.object({
    url: z
      .string()
      .url('Supabase URL must be a valid URL')
      .refine(
        (url) => {
          // Allow localhost for development
          if (url.includes('localhost') || url.includes('127.0.0.1')) {
            return true;
          }
          // For production, ensure it's a Supabase URL
          return url.includes('supabase.co') || url.includes('supabase.in');
        },
        {
          message:
            'URL must be a valid Supabase URL or localhost for development',
        },
      ),
    anonKey: z
      .string()
      .min(1, 'Supabase anon key is required')
      .refine(
        (key) => {
          // Basic JWT format validation (header.payload.signature)
          const parts = key.split('.');
          return parts.length === 3;
        },
        {
          message: 'Supabase anon key must be a valid JWT token',
        },
      ),
  }),
  backend: z.object({
    apiUrl: z
      .string()
      .url('Backend API URL must be a valid URL')
      .refine(
        (url) => {
          // Ensure it ends with /api/v1 or similar API path
          return url.includes('/api/') || url.includes('localhost');
        },
        {
          message: 'Backend API URL should contain an API path',
        },
      ),
  }),
  postHog: z
    .object({
      apiKey: z
        .string()
        .min(1, 'PostHog API key is required')
        .refine(
          (key) => {
            // PostHog API keys have a specific format: phc_xxxxx
            return key.startsWith('phc_') && key.length > 10;
          },
          {
            message: 'PostHog API key must start with "phc_" and be valid',
          },
        ),
      host: z
        .string()
        .url('PostHog host must be a valid URL')
        .refine(
          (url) => {
            // Allow common PostHog hosts
            return (
              url.includes('posthog.com') ||
              url.includes('posthog.dev') ||
              url.includes('localhost')
            );
          },
          {
            message: 'PostHog host must be a valid PostHog instance URL',
          },
        )
        .default('https://eu.posthog.com'),
      enabled: z.boolean().default(true),
      capturePageviews: z.boolean().default(true),
      capturePageleaves: z.boolean().default(true),
      sessionRecording: z
        .object({
          enabled: z.boolean().default(false),
          maskInputs: z.boolean().default(true),
          sampleRate: z.number().min(0).max(1).default(0.1),
        })
        .optional(),
      debug: z.boolean().default(false),
    })
    .optional(),
  environment: z.enum(['development', 'production', 'local'], {
    errorMap: () => ({
      message: "Environment must be 'development', 'production', or 'local'",
    }),
  }),
});

/**
 * Type inferred from the Zod schema.
 * This is the source of truth for configuration types.
 */
export type ApplicationConfig = z.infer<typeof ConfigSchema>;

/**
 * Type for the raw config file (before validation)
 */
export type ConfigFile = unknown;

/**
 * Validates a configuration object against the schema
 * @param config - The configuration object to validate
 * @returns Validated configuration or throws ZodError
 */
export function validateConfig(config: unknown): ApplicationConfig {
  return ConfigSchema.parse(config);
}

/**
 * Safely validates a configuration object against the schema
 * @param config - The configuration object to validate
 * @returns SafeParseResult with success status and data/error
 */
export function safeValidateConfig(config: unknown) {
  return ConfigSchema.safeParse(config);
}

/**
 * Default configuration for fallback scenarios
 */
export const DEFAULT_CONFIG: ApplicationConfig = {
  supabase: {
    url: 'http://localhost:54321',
    anonKey: '',
  },
  backend: {
    apiUrl: 'http://localhost:3000/api/v1',
  },
  postHog: {
    apiKey: '',
    host: 'https://eu.posthog.com',
    enabled: false, // Disabled by default in fallback config
    capturePageviews: true,
    capturePageleaves: true,
    sessionRecording: {
      enabled: false,
      maskInputs: true,
      sampleRate: 0.1,
    },
    debug: false,
  },
  environment: 'development',
};

/**
 * Get a user-friendly error message from Zod validation errors
 * @param error - The Zod error object
 * @returns Formatted error message
 */
export function formatConfigError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return `Configuration validation failed:\n${issues.join('\n')}`;
}
