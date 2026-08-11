import { ConfigSchema, EnvSchema, envToConfig } from './config.schema';

const validEnv = {
  PUBLIC_ENVIRONMENT: 'local',
  PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test',
  PUBLIC_BACKEND_API_URL: 'http://localhost:3000/api/v1',
  PUBLIC_POSTHOG_API_KEY: `phc_${'x'.repeat(36)}`,
  PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  PUBLIC_POSTHOG_ENABLED: 'false',
  PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS: 'true',
  PUBLIC_POSTHOG_CAPTURE_PAGELEAVES: 'true',
  PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED: 'false',
  PUBLIC_POSTHOG_MASK_INPUTS: 'true',
  PUBLIC_POSTHOG_SAMPLE_RATE: '0.1',
  PUBLIC_POSTHOG_DEBUG: 'false',
  PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAB46FJOy2Xtrp9V6',
} as const;

function expectRejectedByBoth(
  envPatch: Partial<Record<keyof typeof validEnv, string>>,
  configPatch: Record<string, unknown>,
): void {
  expect(EnvSchema.safeParse({ ...validEnv, ...envPatch }).success).toBe(false);

  const config = envToConfig(EnvSchema.parse(validEnv));
  expect(ConfigSchema.safeParse({ ...config, ...configPatch }).success).toBe(
    false,
  );
}

describe('configuration URL validation', () => {
  it('accepts the documented local and production formats', () => {
    const localEnv = EnvSchema.parse(validEnv);
    expect(ConfigSchema.safeParse(envToConfig(localEnv)).success).toBe(true);

    const productionEnv = EnvSchema.parse({
      ...validEnv,
      PUBLIC_ENVIRONMENT: 'production',
      PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      PUBLIC_BACKEND_API_URL: 'https://api.pulpe.app/api/v1',
      PUBLIC_POSTHOG_HOST: '/ph',
      PUBLIC_POSTHOG_ENABLED: 'true',
    });
    expect(ConfigSchema.safeParse(envToConfig(productionEnv)).success).toBe(
      true,
    );
  });

  it.each([
    'https://project.supabase.co.attacker.example',
    'https://attacker.example/?next=supabase.co',
  ])('rejects deceptive Supabase URL %s', (url) => {
    expectRejectedByBoth(
      { PUBLIC_SUPABASE_URL: url },
      { supabase: { ...envToConfig(EnvSchema.parse(validEnv)).supabase, url } },
    );
  });

  it('rejects a backend URL whose API path only appears in the query', () => {
    const apiUrl = 'https://attacker.example/?next=/api/v1';
    expectRejectedByBoth(
      { PUBLIC_BACKEND_API_URL: apiUrl },
      { backend: { apiUrl } },
    );
  });

  it.each(['https://posthog.com.attacker.example', '//attacker.example/ph'])(
    'rejects deceptive PostHog host %s',
    (host) => {
      expectRejectedByBoth(
        { PUBLIC_POSTHOG_HOST: host },
        {
          postHog: {
            ...envToConfig(EnvSchema.parse(validEnv)).postHog,
            host,
          },
        },
      );
    },
  );
});
