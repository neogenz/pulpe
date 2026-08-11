/**
 * Runtime configuration, mirroring `AppConfiguration.swift` on iOS and
 * `generate-config.ts` on the web: every value is required, and a missing one
 * fails at startup rather than producing a request to `undefined/budgets`.
 *
 * Metro inlines `process.env.EXPO_PUBLIC_*` at build time by substituting the
 * literal expression, so each variable has to be spelled out here. Reading them
 * through a computed key (`process.env[name]`) always yields `undefined`.
 */
const RAW_ENV = {
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
} as const;

const APP_ENVIRONMENTS = ["local", "preview", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

function requiredValue(name: keyof typeof RAW_ENV): string {
  const value = RAW_ENV[name];
  if (!value) {
    throw new Error(
      `Missing EXPO_PUBLIC_${name}. Copy android/.env.example to android/.env and restart Metro with --clear.`,
    );
  }
  return value;
}

function requiredEnvironment(): AppEnvironment {
  const value = requiredValue("APP_ENV");
  const environment = APP_ENVIRONMENTS.find((candidate) => candidate === value);
  if (!environment) {
    throw new Error(
      `Invalid EXPO_PUBLIC_APP_ENV "${value}". Expected one of: ${APP_ENVIRONMENTS.join(", ")}.`,
    );
  }
  return environment;
}

export const ENV = {
  environment: requiredEnvironment(),
  apiBaseUrl: requiredValue("API_BASE_URL"),
  supabaseUrl: requiredValue("SUPABASE_URL"),
  supabaseAnonKey: requiredValue("SUPABASE_ANON_KEY"),
} as const;

export const isProduction = ENV.environment === "production";
