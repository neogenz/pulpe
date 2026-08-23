import { describe, expect, it } from 'vitest';
import { appVersionResponseSchema } from '../schemas.js';

const ANDROID = { minVersion: '0.43.0', latestVersion: '0.43.0' };
const IOS = { minVersion: '1.0.0', latestVersion: '1.0.0' };
const WEB = { minVersion: '0.0.1', latestVersion: '0.0.1' };

function payload(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: { android: ANDROID, ios: IOS, web: WEB, ...overrides },
  };
}

describe('appVersionResponseSchema', () => {
  it('should accept a well-formed payload with storeUrl', () => {
    const result = appVersionResponseSchema.safeParse(
      payload({
        android: {
          ...ANDROID,
          storeUrl:
            'https://play.google.com/store/apps/details?id=app.pulpe.android',
        },
        ios: { ...IOS, storeUrl: 'https://apps.apple.com/app/pulpe' },
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should accept a payload without storeUrl', () => {
    const result = appVersionResponseSchema.safeParse(payload());

    expect(result.success).toBe(true);
  });

  it.each(['1.0', '1', 'latest', '1.0.0-beta', '1.0.0.1', ''])(
    'should reject non-semver version: %s',
    (value) => {
      const result = appVersionResponseSchema.safeParse(
        payload({ ios: { minVersion: value, latestVersion: '1.0.0' } }),
      );

      expect(result.success).toBe(false);
    },
  );

  it('should reject non-URL storeUrl', () => {
    const result = appVersionResponseSchema.safeParse(
      payload({ ios: { ...IOS, storeUrl: 'oops' } }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject success=false', () => {
    const result = appVersionResponseSchema.safeParse({
      ...payload(),
      success: false,
    });

    expect(result.success).toBe(false);
  });

  it.each(['android', 'ios', 'web'] as const)(
    'should reject a payload missing the %s platform',
    (platform) => {
      const { [platform]: _dropped, ...remaining } = payload().data;

      const result = appVersionResponseSchema.safeParse({
        success: true,
        data: remaining,
      });

      expect(result.success).toBe(false);
    },
  );
});
