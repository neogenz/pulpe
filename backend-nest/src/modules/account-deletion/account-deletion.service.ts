import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { SupabaseService } from '../supabase/supabase.service';

interface ScheduledDeletionUser {
  id: string;
  email?: string;
  user_metadata?: {
    scheduledDeletionAt?: string;
  };
}

/**
 * Grace period in days before an account scheduled for deletion is actually removed.
 * This provides a buffer for users to contact support if they change their mind,
 * and ensures compliance with data retention best practices.
 */
const GRACE_PERIOD_DAYS = 3;
const MAX_PAGES = 100; // Safety limit: ~100k users max

/**
 * Service responsible for cleaning up accounts scheduled for deletion
 *
 * Runs daily at 2 AM to delete users whose grace period has expired
 * Uses Supabase Admin API to identify and delete scheduled users
 *
 * Tables cleaned via CASCADE when user is deleted:
 * - template (user_id) → template_line (template_id)
 * - monthly_budget (user_id) → budget_line (budget_id), transaction (budget_id)
 * - savings_goal (user_id)
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectInfoLogger(AccountDeletionService.name)
    private readonly logger: InfoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Cleanup job that runs daily at 2 AM to delete expired scheduled accounts
   *
   * Schedule: Daily at 2:00 AM UTC
   * Grace period: 3 days from scheduledDeletionAt
   *
   * Process:
   * 1. Query auth.users for users with scheduledDeletionAt in user_metadata
   * 2. Filter users where scheduledDeletionAt + 3 days < now
   * 3. Delete each user via Admin API (cascade handles related data)
   */
  @Cron('0 2 * * *')
  async cleanupScheduledDeletions(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting scheduled account deletion cleanup job');

    try {
      const adminClient = this.supabaseService.getServiceRoleClient();
      const now = new Date();

      const expiredUsers = await this.findExpiredScheduledUsers(
        adminClient,
        now,
      );

      if (expiredUsers.length === 0) {
        this.logger.info('No expired scheduled deletions to process');
        return;
      }

      const deleteResults = await this.deleteUsers(adminClient, expiredUsers);
      this.logCleanupResults(deleteResults, expiredUsers.length, startTime);
    } catch (error) {
      this.logger.warn(
        { err: error, duration: Date.now() - startTime },
        'Scheduled account deletion cleanup job failed',
      );
    }
  }

  private async findExpiredScheduledUsers(
    adminClient: SupabaseClient,
    now: Date,
  ): Promise<ScheduledDeletionUser[]> {
    const perPage = 1000;
    let page = 1;
    const expiredUsers: ScheduledDeletionUser[] = [];

    while (page <= MAX_PAGES) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        this.logger.warn(
          { err: error, page },
          'Failed to list users for scheduled deletion cleanup',
        );
        break;
      }

      const usersOnPage = data?.users ?? [];
      expiredUsers.push(...this.extractExpiredScheduledUsers(usersOnPage, now));

      if (usersOnPage.length < perPage) {
        break;
      }

      page += 1;
    }

    this.logger.info(
      { count: expiredUsers.length },
      'Found expired scheduled deletions to process',
    );

    return expiredUsers;
  }

  private extractExpiredScheduledUsers(
    users: ScheduledDeletionUser[],
    now: Date,
  ): ScheduledDeletionUser[] {
    return users.filter((user: ScheduledDeletionUser) => {
      const scheduledAt = user.user_metadata?.scheduledDeletionAt;
      if (!scheduledAt) {
        return false;
      }

      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        this.logger.warn(
          { userId: user.id, scheduledAt },
          'Invalid scheduledDeletionAt date format',
        );
        return false;
      }

      const expirationDate = new Date(
        scheduledDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );

      return now >= expirationDate;
    });
  }

  private async deleteUsers(
    adminClient: SupabaseClient,
    users: ScheduledDeletionUser[],
  ) {
    return Promise.allSettled(
      users.map(async (user: ScheduledDeletionUser) => {
        const { error } = await adminClient.auth.admin.deleteUser(user.id);

        if (error) {
          this.logger.warn(
            { userId: user.id, email: user.email, err: error },
            'Failed to delete scheduled account',
          );
          throw error;
        }

        this.logger.info(
          { userId: user.id, email: user.email },
          'Scheduled account deleted successfully',
        );
      }),
    );
  }

  private logCleanupResults(
    deleteResults: PromiseSettledResult<void>[],
    total: number,
    startTime: number,
  ) {
    const successCount = deleteResults.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failureCount = deleteResults.filter(
      (r) => r.status === 'rejected',
    ).length;

    this.logger.info(
      {
        total,
        succeeded: successCount,
        failed: failureCount,
        duration: Date.now() - startTime,
      },
      'Scheduled account deletion cleanup job completed',
    );
  }
}
