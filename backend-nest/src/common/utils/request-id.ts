import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { REQUEST_ID_HEADER } from 'pulpe-shared';

const REQUEST_ID_HEADER_LOWER = REQUEST_ID_HEADER.toLowerCase();

export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReqId = string | number | object;

type ReqWithHeaders = IncomingMessage & {
  id?: ReqId;
  headers: Record<string, string | string[] | undefined>;
};

function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value);
}

export function createRequestIdGenerator() {
  return (req: ReqWithHeaders, res: ServerResponse): string | number => {
    const existingId = req.id;
    if (typeof existingId === 'string' || typeof existingId === 'number') {
      return existingId;
    }

    const headerValue = req.headers[REQUEST_ID_HEADER_LOWER];
    if (headerValue) {
      const fromHeader = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;
      if (isValidRequestId(fromHeader)) {
        res.setHeader(REQUEST_ID_HEADER, fromHeader);
        return fromHeader;
      }
    }

    const generated = randomUUID();
    res.setHeader(REQUEST_ID_HEADER, generated);
    return generated;
  };
}
