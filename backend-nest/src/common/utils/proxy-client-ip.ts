import { isIP } from 'node:net';
import type { Request } from 'express';

/** Railway overwrites X-Real-IP; never trust the client-extensible X-Forwarded-For list. */
export function proxyClientIp(request: Request): string | undefined {
  const value = request.headers?.['x-real-ip'];
  const ip = Array.isArray(value) ? value[0] : value;
  return ip && isIP(ip) !== 0 ? ip : undefined;
}
