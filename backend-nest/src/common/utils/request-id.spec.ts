import { describe, it, expect, mock } from 'bun:test';
import { createRequestIdGenerator, UUID_V4_PATTERN } from './request-id';
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

const VALID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_VALID_V4 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('createRequestIdGenerator', () => {
  it('should reuse req.id when already set by upstream middleware', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({ id: 'upstream-id-123' });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe('upstream-id-123');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('should reuse the incoming x-request-id header when valid UUID v4', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({ headers: { 'x-request-id': VALID_V4 } });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe(VALID_V4);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', VALID_V4);
  });

  it('should pick the first value when x-request-id is an array of valid UUIDs', () => {
    const generator = createRequestIdGenerator();
    const req = createReq({
      headers: { 'x-request-id': [VALID_V4, ANOTHER_VALID_V4] },
    });
    const { res, setHeader } = createRes();

    const result = generator(req, res);

    expect(result).toBe(VALID_V4);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', VALID_V4);
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

  describe('input validation against untrusted client headers', () => {
    const MALICIOUS_INPUTS: Array<[string, string]> = [
      ['arbitrary non-UUID string', 'not-a-uuid'],
      ['CRLF log injection attempt', 'valid\r\n[FAKE LOG] hacked'],
      ['newline injection attempt', 'first-line\nsecond-line'],
      ['null byte injection', 'abc\x00def'],
      ['ANSI escape sequence', '\x1b[31mRED\x1b[0m'],
      ['SQL injection-like payload', "1' OR '1'='1"],
      ['path traversal payload', '../../etc/passwd'],
      ['oversized 1000-char string', 'a'.repeat(1000)],
      ['UUID v1 (wrong version)', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
      [
        'UUID with invalid variant nibble',
        '550e8400-e29b-41d4-c716-446655440000',
      ],
      ['UUID with extra trailing chars', `${VALID_V4}-extra`],
      ['truncated UUID', '550e8400-e29b-41d4-a716'],
    ];

    for (const [label, payload] of MALICIOUS_INPUTS) {
      it(`should reject ${label} and generate a fresh UUID v4`, () => {
        const generator = createRequestIdGenerator();
        const req = createReq({ headers: { 'x-request-id': payload } });
        const { res, setHeader } = createRes();

        const result = generator(req, res);

        expect(result).not.toBe(payload);
        expect(result).toMatch(UUID_V4_PATTERN);
        expect(setHeader).toHaveBeenCalledWith('X-Request-Id', result);
      });
    }

    it('should reject array whose first value is malicious and fall back to generation', () => {
      const generator = createRequestIdGenerator();
      const req = createReq({
        headers: { 'x-request-id': ['malicious\r\nvalue', VALID_V4] },
      });
      const { res, setHeader } = createRes();

      const result = generator(req, res);

      expect(result).not.toBe('malicious\r\nvalue');
      expect(result).not.toBe(VALID_V4);
      expect(result).toMatch(UUID_V4_PATTERN);
      expect(setHeader).toHaveBeenCalledWith('X-Request-Id', result);
    });
  });
});
