import type { ScheduledDeletionUser } from '../account-deletion.entity';

export const ACCOUNT_DELETION_REPOSITORY = Symbol(
  'ACCOUNT_DELETION_REPOSITORY',
);

export interface AccountDeletionRepositoryPort {
  /**
   * List users whose grace period has expired (relative to `now`).
   * Implementations are expected to scan all users via the admin API
   * and filter those whose `user_metadata.scheduledDeletionAt + grace`
   * has passed.
   */
  listExpiredScheduledUsers(now: Date): Promise<ScheduledDeletionUser[]>;

  /**
   * Delete a single user by id via the admin API.
   * Cascades related rows in `template`, `monthly_budget`, `transaction`,
   * `savings_goal`, etc. via FK ON DELETE CASCADE.
   */
  deleteUser(userId: string): Promise<void>;
}
