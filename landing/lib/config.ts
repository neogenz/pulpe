export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || ''

export function angularUrl(path: string, utmContent: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${ANGULAR_APP_URL}${path}${separator}utm_source=landing&utm_medium=cta&utm_content=${encodeURIComponent(utmContent)}`;
}
