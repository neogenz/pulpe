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
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  POSTHOG_API_KEY: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
  POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  POSTHOG_ENABLED: process.env.EXPO_PUBLIC_POSTHOG_ENABLED,
} as const;

const APP_ENVIRONMENTS = ["local", "preview", "production"] as const;

/** The same region iOS posts to (`ios/Config/Base.xcconfig`). */
const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/**
 * A build that reaches here without its variables is dead either way, so the
 * message has to say where to put them — and the answer differs by who is
 * building. Metro reads `android/.env`; EAS reads the profile's `env` block,
 * and nothing tells the two apart at runtime except the environment itself.
 */
function missingValueMessage(name: keyof typeof RAW_ENV): string {
  const profile = RAW_ENV.APP_ENV;
  const where =
    profile === undefined || profile === "local"
      ? "Copy android/.env.example to android/.env and restart Metro with --clear."
      : `Add it to the "${profile}" profile's env block in android/eas.json, then rebuild.`;

  return `Missing EXPO_PUBLIC_${name}. ${where}`;
}

function requiredValue(name: keyof typeof RAW_ENV): string {
  const value = RAW_ENV[name];
  if (!value) throw new Error(missingValueMessage(name));
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

function requiredServiceUrl(
  name: "API_BASE_URL" | "SUPABASE_URL",
  environment: AppEnvironment,
): string {
  const value = requiredValue(name);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_${name} URL.`);
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(environment === "local" && url.protocol === "http:" && isLoopback)
  ) {
    throw new Error(
      `EXPO_PUBLIC_${name} must use HTTPS; local HTTP is limited to loopback hosts.`,
    );
  }

  return value;
}

const environment = requiredEnvironment();

export const ENV = {
  environment,
  apiBaseUrl: requiredServiceUrl("API_BASE_URL", environment),
  supabaseUrl: requiredServiceUrl("SUPABASE_URL", environment),
  supabaseAnonKey: requiredValue("SUPABASE_ANON_KEY"),
  // Optional, unlike the rest: sign-in by e-mail has to keep working on a
  // build where Google is not wired up yet. The button hides instead.
  googleWebClientId: RAW_ENV.GOOGLE_WEB_CLIENT_ID ?? null,
  // No Sentry project exists yet, so every profile is missing this one and
  // crash reporting stays off until a human creates one. Absent rather than
  // empty: a DSN of "" would be an init failure instead of a decision.
  sentryDsn: RAW_ENV.SENTRY_DSN ?? null,
  /**
   * Null means "do not measure anything", which is the answer whenever the
   * profile says so or the key is absent — one check for both, so no caller
   * can honour the flag and forget the key. Mirrors iOS, where
   * `POSTHOG_ENABLED` is true on production alone.
   */
  posthog:
    RAW_ENV.POSTHOG_ENABLED === "true" && RAW_ENV.POSTHOG_API_KEY
      ? {
          apiKey: RAW_ENV.POSTHOG_API_KEY,
          host: RAW_ENV.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
        }
      : null,
} as const;

export const isProduction = ENV.environment === "production";
