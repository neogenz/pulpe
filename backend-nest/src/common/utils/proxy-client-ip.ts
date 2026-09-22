import { isIP } from 'node:net';

interface ClientIpRequest {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

export function isRailwayProxyTrusted(
  railwayEnvironmentName: string | null | undefined,
): boolean {
  return Boolean(railwayEnvironmentName?.trim());
}

/** Railway overwrites X-Real-IP; never trust the client-extensible X-Forwarded-For list. */
export function proxyClientIp(request: ClientIpRequest): string | undefined {
  const value = request.headers?.['x-real-ip'];
  const ip = Array.isArray(value) ? value[0] : value;
  return ip && isIP(ip) !== 0 ? ip : undefined;
}
