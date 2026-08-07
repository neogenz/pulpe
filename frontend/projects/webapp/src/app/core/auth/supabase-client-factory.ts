import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds the Supabase client, reached through DI, so a test can hand back a
 * double instead of opening a real connection.
 *
 * The `import()` is dynamic only to keep the call off the module's top level —
 * it does not defer the download. `auth-session.service.ts` imports
 * `isAuthRetryableFetchError` as a value, which already pulls the SDK into the
 * initial bundle; splitting it here would take removing that import first.
 */
export const SUPABASE_CLIENT_FACTORY = new InjectionToken<
  (url: string, key: string) => Promise<SupabaseClient>
>('SUPABASE_CLIENT_FACTORY', {
  providedIn: 'root',
  factory: () => async (url, key) => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key);
  },
});
