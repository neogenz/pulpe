/**
 * Grace period in days before an account scheduled for deletion is actually removed.
 * Provides a buffer for users to contact support if they change their mind,
 * and ensures compliance with data retention best practices.
 */
export const GRACE_PERIOD_DAYS = 3;

export interface ScheduledDeletionUser {
  id: string;
  email?: string;
  user_metadata?: {
    scheduledDeletionAt?: string;
  };
}

export interface BulkDeletionResult {
  total: number;
  succeeded: number;
  failed: number;
}
