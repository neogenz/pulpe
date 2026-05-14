import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { HttpPostHogPersonDeletionAdapter } from './http-posthog-person-deletion.adapter';

const DISTINCT_ID = 'user-abc-123';
const POSTHOG_HOST = 'https://eu.posthog.com';
const POSTHOG_PROJECT_ID = 'PROJ';
const POSTHOG_API_KEY = 'phx_test_key';
const EXPECTED_URL = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/persons/bulk_delete/`;

const fullConfig: Record<string, string> = {
  POSTHOG_API_KEY,
  POSTHOG_PROJECT_ID,
  POSTHOG_HOST,
};

type FetchMock = ReturnType<typeof mock>;

interface MockLogger {
  info: ReturnType<typeof mock>;
  warn: ReturnType<typeof mock>;
  debug: ReturnType<typeof mock>;
  trace: ReturnType<typeof mock>;
}

interface BuiltAdapter {
  adapter: HttpPostHogPersonDeletionAdapter;
  logger: MockLogger;
}

const buildResponse = (status: number): Response =>
  new Response(null, { status });

const buildModule = async (
  config: Record<string, string | undefined>,
): Promise<BuiltAdapter> => {
  const logger: MockLogger = {
    info: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
    trace: mock(() => {}),
  };
  const mockConfigService = {
    get: (key: string) => config[key],
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      HttpPostHogPersonDeletionAdapter,
      { provide: ConfigService, useValue: mockConfigService },
      {
        provide: `INFO_LOGGER:${HttpPostHogPersonDeletionAdapter.name}`,
        useValue: logger,
      },
    ],
  }).compile();

  return { adapter: module.get(HttpPostHogPersonDeletionAdapter), logger };
};

describe('HttpPostHogPersonDeletionAdapter', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: FetchMock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = mock(async () => buildResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('disabled (missing config)', () => {
    it('returns disabled when POSTHOG_API_KEY is missing', async () => {
      const { adapter } = await buildModule({
        POSTHOG_PROJECT_ID,
        POSTHOG_HOST,
      });

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'disabled' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns disabled when POSTHOG_PROJECT_ID is missing', async () => {
      const { adapter } = await buildModule({
        POSTHOG_API_KEY,
        POSTHOG_HOST,
      });

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'disabled' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns disabled when POSTHOG_HOST is missing', async () => {
      const { adapter } = await buildModule({
        POSTHOG_API_KEY,
        POSTHOG_PROJECT_ID,
      });

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'disabled' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('successful calls', () => {
    it('returns ok with 200 statusCode and posts the expected payload', async () => {
      fetchMock = mock(async () => buildResponse(200));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: true, statusCode: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(calledUrl).toBe(EXPECTED_URL);
      expect(calledInit.method).toBe('POST');
      const headers = calledInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${POSTHOG_API_KEY}`);
      expect(headers['Content-Type']).toBe('application/json');
      const parsedBody = JSON.parse(calledInit.body as string);
      expect(parsedBody).toEqual({
        distinct_ids: [DISTINCT_ID],
        delete_events: true,
        delete_recordings: true,
      });
      expect(calledInit.signal).toBeDefined();
    });

    it('returns ok with 202 statusCode when PostHog accepts asynchronously', async () => {
      fetchMock = mock(async () => buildResponse(202));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: true, statusCode: 202 });
    });
  });

  describe('error responses', () => {
    it('returns ok soft-success and logs at info level when PostHog responds 404', async () => {
      fetchMock = mock(async () => buildResponse(404));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter, logger } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: true, statusCode: 404 });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('returns http_error when PostHog responds 401', async () => {
      fetchMock = mock(async () => buildResponse(401));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({
        ok: false,
        reason: 'http_error',
        statusCode: 401,
      });
    });

    it('returns http_error when PostHog responds 500', async () => {
      fetchMock = mock(async () => buildResponse(500));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({
        ok: false,
        reason: 'http_error',
        statusCode: 500,
      });
    });

    it('returns http_error and never throws when fetch rejects with a network error', async () => {
      fetchMock = mock(async () => {
        throw new TypeError('fetch failed');
      });
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'http_error' });
    });

    it('returns timeout when fetch rejects with an AbortError', async () => {
      fetchMock = mock(async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      });
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'timeout' });
    });

    it('returns timeout when fetch rejects with a TimeoutError (AbortSignal.timeout)', async () => {
      fetchMock = mock(async () => {
        const error = new Error('signal timed out');
        error.name = 'TimeoutError';
        throw error;
      });
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const { adapter } = await buildModule(fullConfig);

      const result = await adapter.deletePerson(DISTINCT_ID);

      expect(result).toEqual({ ok: false, reason: 'timeout' });
    });
  });
});
