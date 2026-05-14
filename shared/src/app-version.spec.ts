import { describe, expect, it } from 'vitest';
import { appVersionResponseSchema } from '../schemas.js';

describe('appVersionResponseSchema', () => {
  it('should accept a well-formed payload with storeUrl', () => {
    const result = appVersionResponseSchema.safeParse({
      success: true,
      data: {
        ios: {
          minVersion: '1.0.0',
          latestVersion: '1.0.2',
          storeUrl: 'https://apps.apple.com/app/pulpe',
        },
        web: { minVersion: '0.0.1', latestVersion: '0.34.1' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('should accept a payload without storeUrl', () => {
    const result = appVersionResponseSchema.safeParse({
      success: true,
      data: {
        ios: { minVersion: '1.0.0', latestVersion: '1.0.0' },
        web: { minVersion: '0.0.1', latestVersion: '0.0.1' },
      },
    });

    expect(result.success).toBe(true);
  });

  it.each(['1.0', '1', 'latest', '1.0.0-beta', '1.0.0.1', ''])(
    'should reject non-semver version: %s',
    (value) => {
      const result = appVersionResponseSchema.safeParse({
        success: true,
        data: {
          ios: { minVersion: value, latestVersion: '1.0.0' },
          web: { minVersion: '0.0.1', latestVersion: '0.0.1' },
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it('should reject non-URL storeUrl', () => {
    const result = appVersionResponseSchema.safeParse({
      success: true,
      data: {
        ios: { minVersion: '1.0.0', latestVersion: '1.0.0', storeUrl: 'oops' },
        web: { minVersion: '0.0.1', latestVersion: '0.0.1' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('should reject success=false', () => {
    const result = appVersionResponseSchema.safeParse({
      success: false,
      data: {
        ios: { minVersion: '1.0.0', latestVersion: '1.0.0' },
        web: { minVersion: '0.0.1', latestVersion: '0.0.1' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing web platform', () => {
    const result = appVersionResponseSchema.safeParse({
      success: true,
      data: {
        ios: { minVersion: '1.0.0', latestVersion: '1.0.0' },
      },
    });

    expect(result.success).toBe(false);
  });
});
