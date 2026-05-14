import { describe, it, expect } from 'bun:test';
import type { ConfigService } from '@nestjs/config';
import { buildAppVersionResponse } from './app-version-handler';

function createMockConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('buildAppVersionResponse', () => {
  it('should produce a valid AppVersionResponse from well-formed env values', () => {
    const config = createMockConfig({
      MIN_IOS_VERSION: '1.0.0',
      LATEST_IOS_VERSION: '1.0.2',
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_WEB_VERSION: '0.0.1',
      LATEST_WEB_VERSION: '0.34.1',
    });

    const result = buildAppVersionResponse(config);

    expect(result.success).toBe(true);
    expect(result.data.ios.minVersion).toBe('1.0.0');
    expect(result.data.ios.latestVersion).toBe('1.0.2');
    expect(result.data.ios.storeUrl).toBe('https://apps.apple.com/app/pulpe');
    expect(result.data.web.minVersion).toBe('0.0.1');
    expect(result.data.web.latestVersion).toBe('0.34.1');
  });

  it('should throw when a version is not semver-shaped', () => {
    const config = createMockConfig({
      MIN_IOS_VERSION: 'latest',
      LATEST_IOS_VERSION: '1.0.0',
      IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      MIN_WEB_VERSION: '0.0.1',
      LATEST_WEB_VERSION: '0.0.1',
    });

    expect(() => buildAppVersionResponse(config)).toThrow();
  });

  it('should throw when IOS_STORE_URL is not a URL', () => {
    const config = createMockConfig({
      MIN_IOS_VERSION: '1.0.0',
      LATEST_IOS_VERSION: '1.0.0',
      IOS_STORE_URL: 'not-a-url',
      MIN_WEB_VERSION: '0.0.1',
      LATEST_WEB_VERSION: '0.0.1',
    });

    expect(() => buildAppVersionResponse(config)).toThrow();
  });
});
