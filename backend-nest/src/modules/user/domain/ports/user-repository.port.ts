import type {
  UpdateUserProfileInput,
  UpdateUserSettingsInput,
  UserProfile,
  UserSettings,
} from '../user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * Persistence port for the user module.
 *
 * Each implementation owns the choice of Supabase client (authenticated vs
 * service-role) per method:
 * - profile reads/writes go through the authenticated (JWT-scoped) client;
 * - settings writes and the deletion-scheduling path require the service-role
 *   client because Supabase only allows admin to mutate `user_metadata`
 *   atomically when the change must be applied with full metadata replacement.
 */
export interface UserRepositoryPort {
  /**
   * Update the authenticated user's profile (firstName/lastName) in
   * `auth.users.user_metadata`. Uses the JWT-scoped authenticated client.
   */
  updateProfile(input: UpdateUserProfileInput): Promise<UserProfile>;

  /**
   * Read the authenticated user's settings from `auth.users.user_metadata`.
   * Uses the JWT-scoped authenticated client.
   */
  findSettings(): Promise<UserSettings>;

  /**
   * Update settings keys for `userId` while preserving the rest of
   * `user_metadata`. Uses the service-role admin client because the change
   * must be applied with full metadata replacement.
   */
  updateSettings(
    userId: string,
    patch: UpdateUserSettingsInput,
  ): Promise<UserSettings>;

  /**
   * Set `user_metadata.scheduledDeletionAt` to "now" if absent. Returns the
   * (existing or newly written) ISO timestamp and a flag indicating whether
   * a write actually occurred. Uses the service-role admin client.
   */
  scheduleDeletion(userId: string): Promise<{
    scheduledDeletionAt: string;
    alreadyScheduled: boolean;
  }>;

  /**
   * Globally sign out the user identified by `accessToken`. Uses the
   * service-role admin client (`auth.admin.signOut(token, 'global')`).
   */
  signOutGlobally(accessToken: string): Promise<void>;
}
