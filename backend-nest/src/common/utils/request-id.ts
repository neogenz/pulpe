import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { REQUEST_ID_HEADER, REQUEST_ID_HEADER_LOWER } from 'pulpe-shared';

type ReqId = string | number | object;

type ReqWithHeaders = IncomingMessage & {
  id?: ReqId;
  headers: Record<string, string | string[] | undefined>;
};

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
      if (fromHeader) {
        res.setHeader(REQUEST_ID_HEADER, fromHeader);
        return fromHeader;
      }
    }

    const generated = randomUUID();
    res.setHeader(REQUEST_ID_HEADER, generated);
    return generated;
  };
}
