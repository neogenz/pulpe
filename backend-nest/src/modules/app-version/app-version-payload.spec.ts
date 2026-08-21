import { describe, it, expect } from 'bun:test';
import type { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAppVersionResponse } from './app-version-payload';
import type { IosVersionGate } from './ios-version-gate.service';

const IOS_VERSIONS: IosVersionGate = {
  minVersion: '1.0.0',
  latestVersion: '1.0.2',
};
const PRODUCT_VERSION = (
  JSON.parse(
    readFileSync(join(__dirname, '../../../package.json'), 'utf8'),
  ) as {
    version: string;
  }
).version;

function createMockConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('buildAppVersionResponse', () => {
  it('should produce a valid AppVersionResponse from well-formed values', () => {
    const config = createMockConfig({
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_ANDROID_VERSION: '0.42.0',
      LATEST_ANDROID_VERSION: '0.43.0',
      ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=app.pulpe.android',
      MIN_WEB_VERSION: '0.0.1',
    });

    const result = buildAppVersionResponse(config, IOS_VERSIONS);

    expect(result.success).toBe(true);
    expect(result.data.ios.minVersion).toBe('1.0.0');
    expect(result.data.ios.latestVersion).toBe('1.0.2');
    expect(result.data.ios.storeUrl).toBe('https://apps.apple.com/app/pulpe');
    expect(result.data.web.minVersion).toBe('0.0.1');
    expect(result.data.web.latestVersion).toBe(PRODUCT_VERSION);
    expect(result.data.android.minVersion).toBe('0.42.0');
    expect(result.data.android.latestVersion).toBe('0.43.0');
    expect(result.data.android.storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=app.pulpe.android',
    );
  });

  it('should throw when ANDROID_STORE_URL is not a URL', () => {
    const config = createMockConfig({
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_ANDROID_VERSION: '0.42.0',
      LATEST_ANDROID_VERSION: '0.43.0',
      ANDROID_STORE_URL: 'not-a-url',
      MIN_WEB_VERSION: '0.0.1',
    });

    expect(() => buildAppVersionResponse(config, IOS_VERSIONS)).toThrow();
  });

  it('preserves the configured web minimum across an artifact rollback', () => {
    const config = createMockConfig({
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_ANDROID_VERSION: '0.42.0',
      LATEST_ANDROID_VERSION: '0.43.0',
      ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=app.pulpe.android',
      MIN_WEB_VERSION: '99.0.0',
    });

    const result = buildAppVersionResponse(config, IOS_VERSIONS);

    expect(result.data.web.minVersion).toBe('99.0.0');
    expect(result.data.web.latestVersion).toBe(PRODUCT_VERSION);
  });

  it('should throw when a version is not semver-shaped', () => {
    const config = createMockConfig({
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_ANDROID_VERSION: '0.42.0',
      LATEST_ANDROID_VERSION: '0.43.0',
      ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=app.pulpe.android',
      MIN_WEB_VERSION: '0.0.1',
    });

    expect(() =>
      buildAppVersionResponse(config, {
        minVersion: 'latest',
        latestVersion: '1.0.0',
      }),
    ).toThrow();
  });

  it('should throw when IOS_STORE_URL is not a URL', () => {
    const config = createMockConfig({
      IOS_STORE_URL: 'not-a-url',
      MIN_ANDROID_VERSION: '0.42.0',
      LATEST_ANDROID_VERSION: '0.43.0',
      ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=app.pulpe.android',
      MIN_WEB_VERSION: '0.0.1',
    });

    expect(() => buildAppVersionResponse(config, IOS_VERSIONS)).toThrow();
  });
});
