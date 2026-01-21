import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel Edge Middleware - Auth Redirect
 *
 * Checks Supabase auth cookies and redirects authenticated users
 * from landing page to dashboard before any HTML is sent.
 *
 * Uses direct cookie parsing (Edge-compatible) instead of @supabase/ssr.
 */
export function middleware(request: NextRequest) {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.next();
  }

  // Extract project ref from Supabase URL (e.g., "abc123" from "https://abc123.supabase.co")
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1];
  if (!projectRef) {
    return NextResponse.next();
  }

  // Supabase stores auth in cookie named "sb-<project-ref>-auth-token"
  const authCookieName = `sb-${projectRef}-auth-token`;
  const authCookie = request.cookies.get(authCookieName);

  if (!authCookie?.value) {
    return NextResponse.next();
  }

  // Parse the auth cookie JSON
  let session: { access_token?: string; expires_at?: number } | null = null;
  try {
    session = JSON.parse(authCookie.value);
  } catch {
    return NextResponse.next();
  }

  if (!session?.access_token) {
    return NextResponse.next();
  }

  // Check if token is expired (with 60s buffer)
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now + 60) {
    // Token expired, let Angular handle refresh
    return NextResponse.next();
  }

  // User has valid session - redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url), { status: 307 });
}

export const config = {
  matcher: ['/'],
};
