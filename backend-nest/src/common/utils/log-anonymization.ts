export function anonymizeIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;

  const clientIp = ip.split(',')[0]?.trim();
  if (!clientIp) return undefined;

  const ipv4Parts = clientIp.split('.');
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.x.x`;
  }

  if (clientIp.includes(':')) {
    const segments = clientIp.split(':');
    return `${segments[0]}:${segments[1]}::x`;
  }

  return '[IP_REDACTED]';
}

export function parseDeviceType(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }

  if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone')
  ) {
    return 'mobile';
  }

  return 'desktop';
}
