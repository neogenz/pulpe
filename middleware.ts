import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel Edge Middleware - Auth Redirect
 *
 * Runs before any static file is served. Checks Supabase auth cookies
 * and redirects authenticated users from landing page to dashboard.
 *
 * This prevents the visual "blink" where users see the landing page
 * before being redirected by the Angular app's publicGuard.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookie handlers
  const supabase = createServerClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Verify session with Supabase auth server (not just local JWT check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users from landing page to dashboard
  if (user) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl, { status: 307 });
  }

  // Unauthenticated users see the landing page normally
  return response;
}

export const config = {
  // Only run middleware on the root path (landing page)
  // This avoids affecting Angular routes, assets, and API calls
  matcher: ['/'],
};
