import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;

  const createTestingModule = async (
    nodeEnv: string = 'test',
    secretKey: string = 'test-secret',
  ) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'NODE_ENV') return nodeEnv;
              if (key === 'TURNSTILE_SECRET_KEY') return secretKey;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    return module;
  };

  beforeEach(async () => {
    const module = await createTestingModule();
    service = module.get<TurnstileService>(TurnstileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should skip verification in test environment', async () => {
      const module = await createTestingModule('test');
      const testService = module.get<TurnstileService>(TurnstileService);
      expect(testService).toBeDefined();
    });

    it('should skip verification in local environment', async () => {
      const module = await createTestingModule('local');
      const localService = module.get<TurnstileService>(TurnstileService);
      expect(localService).toBeDefined();
    });

    it('should skip verification in development environment', async () => {
      const module = await createTestingModule('development');
      const devService = module.get<TurnstileService>(TurnstileService);
      expect(devService).toBeDefined();
    });

    it('should enable verification in production environment', async () => {
      const module = await createTestingModule('production');
      const prodService = module.get<TurnstileService>(TurnstileService);
      expect(prodService).toBeDefined();
    });
  });

  describe('verify', () => {
    describe('in non-production environments', () => {
      it('should skip verification and return true in test environment', async () => {
        const result = await service.verify('any-token');
        expect(result).toBe(true);
      });

      it('should skip verification even with empty token', async () => {
        const result = await service.verify('');
        expect(result).toBe(true);
      });

      it('should skip verification even without IP', async () => {
        const result = await service.verify('token-without-ip');
        expect(result).toBe(true);
      });

      it('should skip verification in local environment', async () => {
        const module = await createTestingModule('local');
        const localService = module.get<TurnstileService>(TurnstileService);
        const result = await localService.verify('any-token');
        expect(result).toBe(true);
      });
    });

    describe('in production environments', () => {
      let prodService: TurnstileService;
      let fetchMock: ReturnType<typeof jest.spyOn>;

      beforeEach(async () => {
        const module = await createTestingModule('production', 'prod-secret');
        prodService = module.get<TurnstileService>(TurnstileService);

        // Mock global fetch
        fetchMock = jest.spyOn(global, 'fetch');
      });

      afterEach(() => {
        fetchMock.mockRestore();
      });

      it('should return false if token is empty', async () => {
        const result = await prodService.verify('');
        expect(result).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('should return false if secret key is missing', async () => {
        const module = await createTestingModule('production', '');
        const serviceNoSecret = module.get<TurnstileService>(TurnstileService);
        const result = await serviceNoSecret.verify('valid-token');
        expect(result).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('should call Cloudflare API with correct parameters', async () => {
        fetchMock.mockResolvedValueOnce({
          json: async () => ({ success: true, hostname: 'example.com' }),
        } as Response);

        const result = await prodService.verify('test-token', '1.2.3.4');

        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: 'prod-secret',
              response: 'test-token',
              remoteip: '1.2.3.4',
            }),
          },
        );
      });

      it('should return true when verification succeeds', async () => {
        fetchMock.mockResolvedValueOnce({
          json: async () => ({
            success: true,
            challenge_ts: '2024-01-01T00:00:00Z',
            hostname: 'pulpe.app',
          }),
        } as Response);

        const result = await prodService.verify('valid-token');
        expect(result).toBe(true);
      });

      it('should return false when verification fails', async () => {
        fetchMock.mockResolvedValueOnce({
          json: async () => ({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
        } as Response);

        const result = await prodService.verify('invalid-token');
        expect(result).toBe(false);
      });

      it('should handle network errors gracefully', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const result = await prodService.verify('test-token');
        expect(result).toBe(false);
      });

      it('should handle malformed API responses', async () => {
        fetchMock.mockResolvedValueOnce({
          json: async () => {
            throw new Error('Invalid JSON');
          },
        } as unknown as Response);

        const result = await prodService.verify('test-token');
        expect(result).toBe(false);
      });
    });
  });
});
