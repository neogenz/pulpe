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
 * - locale reads/writes use the authenticated client and owner-only RLS;
 * - legacy budget-setting writes and deletion scheduling use service role.
 */
export interface UserRepositoryPort {
  /**
   * Update the authenticated user's profile (firstName/lastName) in
   * `auth.users.user_metadata`. Uses the JWT-scoped authenticated client.
   */
  updateProfile(input: UpdateUserProfileInput): Promise<UserProfile>;

  /**
   * Read the authenticated user's settings from their persisted sources.
   */
  findSettings(): Promise<UserSettings>;

  /**
   * Update only supplied keys. Locale is persisted in the dedicated table;
   * legacy budget settings preserve the rest of `user_metadata`.
   */
  updateSettings(
    userId: string,
    patch: UpdateUserSettingsInput,
  ): Promise<UserSettings>;

  /**
   * Set `app_metadata.scheduledDeletionAt` to "now" if absent. Returns the
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
