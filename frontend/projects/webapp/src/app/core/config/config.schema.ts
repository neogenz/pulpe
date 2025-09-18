import { z } from 'zod';

/**
 * PostHog API Key validation pattern
 * Must start with 'phc_' followed by alphanumeric characters, underscores, or hyphens
 */
const POSTHOG_KEY_PATTERN = /^phc_[A-Za-z0-9_-]+$/;

/**
 * Configuration Schema for Pulpe Application
 * ==========================================
 *
 * This file contains TWO distinct schemas that work together but serve different purposes:
 *
 * 1. EnvSchema: Validates environment variables (BUILD-TIME)
 * 2. ConfigSchema: Validates config.json structure (RUNTIME)
 *
 * Architecture Flow:
 * ==================
 *
 * BUILD TIME:
 * .env file → EnvSchema.parse() → envToConfig() → ConfigSchema.validate() → config.json
 *   (strings)     (validate)       (transform)        (validate structure)      (write file)
 *
 * RUNTIME:
 * config.json → HTTP GET → ConfigSchema.validate() → Angular Application
 *    (file)      (load)        (ensure integrity)       (use in app)
 *
 * Why Two Schemas?
 * ================
 * - EnvSchema: Handles string env vars with transformation ("true" → boolean)
 * - ConfigSchema: Handles JSON with native types + defaults + optional fields
 * - Double validation ensures data integrity at both build and runtime
 * - Runtime validation protects against file corruption/tampering
 *
 * This is NOT redundant code - each schema validates different data formats!
 */

/**
 * Zod schema for environment variables validation (BUILD-TIME).
 *
 * Purpose: Validates raw string environment variables from .env files
 * Used by: generate-config.ts during build process
 * Format: Flat structure with PUBLIC_ prefix (e.g., PUBLIC_SUPABASE_URL)
 * Transforms: Converts strings to proper types ("true" → boolean, "0.1" → number)
 *
 * This is the source of truth for environment variable validation.
 */
export const EnvSchema = z.object({
  PUBLIC_ENVIRONMENT: z.enum(['development', 'production', 'local', 'test'], {
    errorMap: () => ({
      message:
        "Environment must be 'development', 'production', 'local', or 'test'",
    }),
  }),
  PUBLIC_SUPABASE_URL: z
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
  PUBLIC_SUPABASE_ANON_KEY: z
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
  PUBLIC_BACKEND_API_URL: z
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
  PUBLIC_POSTHOG_API_KEY: z
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
  PUBLIC_POSTHOG_HOST: z
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
    ),
  PUBLIC_POSTHOG_ENABLED: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
  PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
  PUBLIC_POSTHOG_CAPTURE_PAGELEAVES: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
  PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
  PUBLIC_POSTHOG_MASK_INPUTS: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
  PUBLIC_POSTHOG_SAMPLE_RATE: z
    .string()
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 1;
      },
      {
        message: 'Must be a number between 0.0 and 1.0',
      },
    )
    .transform((val) => parseFloat(val)),
  PUBLIC_POSTHOG_DEBUG: z
    .string()
    .refine((val) => val === 'true' || val === 'false', {
      message: 'Must be "true" or "false"',
    })
    .transform((val) => val === 'true'),
});

/**
 * Type inferred from the environment schema.
 */
export type EnvironmentVariables = z.infer<typeof EnvSchema>;

/**
 * Transforms validated environment variables to application configuration.
 *
 * Purpose: Bridges the gap between flat env vars and nested config structure
 * Flow: EnvSchema (strings) → envToConfig() → ConfigSchema (JSON types)
 * Input: Flat structure (PUBLIC_SUPABASE_URL, PUBLIC_BACKEND_API_URL, etc.)
 * Output: Nested structure (supabase.url, backend.apiUrl, etc.)
 */
export function envToConfig(env: EnvironmentVariables): ApplicationConfig {
  return {
    environment: env.PUBLIC_ENVIRONMENT,
    supabase: {
      url: env.PUBLIC_SUPABASE_URL,
      anonKey: env.PUBLIC_SUPABASE_ANON_KEY,
    },
    backend: {
      apiUrl: env.PUBLIC_BACKEND_API_URL,
    },
    postHog: {
      apiKey: env.PUBLIC_POSTHOG_API_KEY,
      host: env.PUBLIC_POSTHOG_HOST,
      enabled: env.PUBLIC_POSTHOG_ENABLED,
      capturePageviews: env.PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS,
      capturePageleaves: env.PUBLIC_POSTHOG_CAPTURE_PAGELEAVES,
      sessionRecording: {
        enabled: env.PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED,
        maskInputs: env.PUBLIC_POSTHOG_MASK_INPUTS,
        sampleRate: env.PUBLIC_POSTHOG_SAMPLE_RATE,
      },
      debug: env.PUBLIC_POSTHOG_DEBUG,
    },
  };
}

/**
 * Zod schema for runtime configuration validation (RUNTIME).
 *
 * Purpose: Validates the final config.json structure when loaded by Angular
 * Used by: Angular application when loading config.json via HTTP
 * Format: Nested JSON structure with proper types (boolean, number, etc.)
 * Features: Includes defaults, optional fields, and structural validation
 *
 * Why this is NOT redundant with EnvSchema:
 * - EnvSchema: Validates string env vars → transforms to types
 * - ConfigSchema: Validates JSON with native types → used by Angular app
 * - Runtime validation ensures config.json integrity (file could be corrupted/modified)
 * - Provides defaults and makes PostHog optional for flexibility
 *
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
            return (
              key.startsWith('phc_') &&
              key.length >= 40 &&
              POSTHOG_KEY_PATTERN.test(key)
            );
          },
          {
            message:
              'PostHog API key must be valid format (phc_xxxxx with at least 40 characters)',
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
  environment: z.enum(['development', 'production', 'local', 'test'], {
    errorMap: () => ({
      message:
        "Environment must be 'development', 'production', 'local', or 'test'",
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
