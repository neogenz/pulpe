import { describe, it, expect, mock } from 'bun:test';
import { createRequestIdGenerator } from './request-id';
import type { IncomingMessage, ServerResponse } from 'http';

type Req = IncomingMessage & {
  id?: string | number | object;
  headers: Record<string, string | string[] | undefined>;
};

const createRes = (): {
  res: ServerResponse;
  setHeader: ReturnType<typeof mock>;
} => {
  const setHeader = mock(() => undefined);
  const res = { setHeader } as unknown as ServerResponse;
  return { res, setHeader };
};

const createReq = (overrides: Partial<Req> = {}): Req =>
  ({
    id: undefined,
    headers: {},
    ...overrides,
  }) as Req;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createRequestIdGenerator', () => {
  it('should reuse req.id when already set by upstream middleware', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({ id: 'upstream-id-123' });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe('upstream-id-123');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('should reuse the incoming x-request-id header when present', () => {
    const generator = createRequestIdGenerator();
    const incomingId = 'feedf00d-dead-beef-cafe-1234567890ab';
    const req = createReq({ headers: { 'x-request-id': incomingId } });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe(incomingId);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', incomingId);
  });

  it('should pick the first value when x-request-id is an array', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({
      headers: { 'x-request-id': ['first-id', 'second-id'] },
    });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe('first-id');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'first-id');
  });

  it('should generate a UUID v4 when no header is provided', () => {
    const generator = createRequestIdGenerator();
    const req = createReq();
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toMatch(UUID_V4_PATTERN);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', result);
  });

  it('should generate a fresh UUID for each invocation when no header is provided', () => {
    const generator = createRequestIdGenerator();
    const firstReq = createReq();
    const secondReq = createReq();
    const { res: firstRes } = createRes();
    const { res: secondRes } = createRes();

    const firstId = generator(firstReq, firstRes);
    const secondId = generator(secondReq, secondRes);

    expect(firstId).not.toBe(secondId);
  });

  it('should fall back to generation when x-request-id is an empty string', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({ headers: { 'x-request-id': '' } });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toMatch(UUID_V4_PATTERN);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', result);
  });
});
