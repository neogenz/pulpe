import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { INFO_LOGGER_TOKEN } from '@common/logger/info-logger.provider';
import { IosVersionGateService } from './ios-version-gate.service';

const BASE_ENV = {
  MIN_IOS_VERSION: '1.0.0',
  LATEST_IOS_VERSION: '1.3.0',
  IOS_STORE_URL: 'https://apps.apple.com/app/id6758464920',
};

function lookupResponse(version: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ version }] }),
  };
}

async function flushPendingRefresh(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('IosVersionGateService', () => {
  let module: TestingModule;
  let service: IosVersionGateService;
  const mockFetch = jest.fn();

  async function createService(
    env: Record<string, string> = BASE_ENV,
  ): Promise<IosVersionGateService> {
    module = await Test.createTestingModule({
      providers: [
        IosVersionGateService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
        {
          provide: `${INFO_LOGGER_TOKEN}:${IosVersionGateService.name}`,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            trace: jest.fn(),
          },
        },
      ],
    }).compile();

    return module.get(IosVersionGateService);
  }

  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
    await module?.close();
  });

  it('should serve the configured versions without waiting for the App Store lookup', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.3.1'));
    service = await createService();

    const gate = service.resolve();

    expect(gate).toEqual({ minVersion: '1.0.0', latestVersion: '1.3.0' });
  });

  it('should adopt the App Store version once the lookup resolves', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.3.1'));
    service = await createService();

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve().latestVersion).toBe('1.3.1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should keep the configured version when the App Store lookup fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    service = await createService();

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve().latestVersion).toBe('1.3.0');
  });

  it('should keep the configured version when the App Store reports an older one', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.2.1'));
    service = await createService();

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve().latestVersion).toBe('1.3.0');
  });

  it('should ignore an App Store version that is not semver-shaped', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.3'));
    service = await createService();

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve().latestVersion).toBe('1.3.0');
  });

  it('should clamp the floor to the version the App Store actually serves', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.3.0'));
    service = await createService({ ...BASE_ENV, MIN_IOS_VERSION: '1.4.0' });

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve()).toEqual({
      minVersion: '1.3.0',
      latestVersion: '1.3.0',
    });
  });

  it('should apply the floor as soon as the App Store catches up', async () => {
    mockFetch.mockResolvedValue(lookupResponse('1.4.0'));
    service = await createService({ ...BASE_ENV, MIN_IOS_VERSION: '1.4.0' });

    service.resolve();
    await flushPendingRefresh();

    expect(service.resolve()).toEqual({
      minVersion: '1.4.0',
      latestVersion: '1.4.0',
    });
  });
});
