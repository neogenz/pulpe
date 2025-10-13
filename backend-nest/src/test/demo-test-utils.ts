import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import type { SupabaseService } from '../modules/supabase/supabase.service';

/**
 * Create an authenticated Supabase client for testing
 * @param supabaseUrl - Supabase project URL
 * @param anonKey - Supabase anonymous key
 * @param accessToken - User access token
 */
export function createAuthenticatedClient(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
) {
  return createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Cleanup test users after tests complete
 * @param supabaseService - SupabaseService instance
 * @param userIds - Array of user IDs to cleanup
 */
export async function cleanupTestUsers(
  supabaseService: SupabaseService,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const adminClient = supabaseService.getServiceRoleClient();

  for (const userId of userIds) {
    try {
      await adminClient.auth.admin.deleteUser(userId);
    } catch (error) {
      // Ignore errors during cleanup (user might already be deleted)
      console.warn(`Failed to cleanup user ${userId}:`, error);
    }
  }
}
