export const config = {
  matcher: ['/'],
};

/**
 * Vercel Edge Middleware - Auth Redirect
 *
 * Uses Web Standard APIs only (no Next.js dependency).
 * Checks Supabase auth cookie and redirects authenticated users to dashboard.
 */
export default function middleware(request: Request): Response | undefined {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return undefined;
  }

  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1];
  if (!projectRef) {
    return undefined;
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const authCookieName = `sb-${projectRef}-auth-token`;
  const cookieMatch = cookieHeader.match(new RegExp(`${authCookieName}=([^;]+)`));

  if (!cookieMatch) {
    return undefined;
  }

  let session: { access_token?: string; expires_at?: number } | null = null;
  try {
    session = JSON.parse(decodeURIComponent(cookieMatch[1]));
  } catch {
    return undefined;
  }

  if (!session?.access_token) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now + 60) {
    return undefined;
  }

  const url = new URL(request.url);
  url.pathname = '/dashboard';
  return Response.redirect(url.toString(), 307);
}
