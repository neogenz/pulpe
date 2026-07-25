export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || ''

// Partagé entre le markup de la sentinelle dans l'en-tête et le script inline du
// layout qui l'observe avant que React n'ait hydraté.
export const SCROLL_SENTINEL_ID = 'scroll-sentinel'
export const GITHUB_URL = 'https://github.com/neogenz/pulpe'
export const CONTACT_EMAIL = 'maxime.desogus@gmail.com'

export function angularUrl(path: string, utmContent: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${ANGULAR_APP_URL}${path}${separator}utm_source=landing&utm_medium=cta&utm_content=${encodeURIComponent(utmContent)}`;
}
