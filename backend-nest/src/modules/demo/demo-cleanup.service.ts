import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';

interface DemoUser {
  id: string;
  email?: string;
  created_at: string;
  user_metadata?: {
    is_demo?: boolean;
  };
}

/**
 * Service responsible for cleaning up expired demo users
 *
 * Runs every 6 hours to delete demo users older than 24 hours
 * Uses Supabase Admin API to identify and delete demo users
 */
@Injectable()
export class DemoCleanupService {
  constructor(
    @InjectPinoLogger(DemoCleanupService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Cleanup job that runs every 6 hours to delete expired demo users
   *
   * Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
   * Retention: 24 hours from user creation
   *
   * Rationale:
   * - 6-hour interval balances cleanup frequency vs database load
   * - 24-hour retention gives users ample time to explore demo
   * - Staggered execution (4x per day) ensures timely cleanup without
   *   overwhelming the database with delete operations
   *
   * Process:
   * 1. Query auth.users for demo users (raw_user_meta_data->>'is_demo' = 'true')
   * 2. Filter users created > 24 hours ago
   * 3. Delete each user via Admin API (cascade handles related data)
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async cleanupExpiredDemoUsers(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting demo users cleanup job');

    try {
      const adminClient = this.supabaseService.getServiceRoleClient();
      const cutoffTime = this.calculateCutoffTime(24);

      const expiredUsers = await this.findExpiredDemoUsers(
        adminClient,
        cutoffTime,
        false, // Cron jobs should not crash on transient errors
      );

      if (expiredUsers.length === 0) {
        this.logger.info('No expired demo users to cleanup');
        return;
      }

      const deleteResults = await this.deleteDemoUsers(
        adminClient,
        expiredUsers,
      );
      this.logCleanupResults(deleteResults, expiredUsers.length, startTime);
    } catch (error) {
      this.logger.error(
        { err: error, duration: Date.now() - startTime },
        'Demo users cleanup job failed',
      );
    }
  }

  private calculateCutoffTime(hoursAgo: number): Date {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);
    this.logger.info(
      { cutoffTime: cutoffTime.toISOString() },
      'Cutoff time calculated',
    );
    return cutoffTime;
  }

  private async findExpiredDemoUsers(
    adminClient: SupabaseClient,
    cutoffTime: Date,
    throwOnError = false,
  ): Promise<DemoUser[]> {
    const { data: allUsers, error: listError } =
      await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      this.logger.error({ err: listError }, 'Failed to list users for cleanup');

      // Throw for manual cleanups to surface errors, return empty for cron jobs
      if (throwOnError) {
        throw listError;
      }
      return [];
    }

    const expiredUsers = allUsers.users.filter((user: DemoUser) => {
      const isDemo = user.user_metadata?.is_demo === true;
      if (!isDemo) return false;

      const createdAt = new Date(user.created_at);
      return createdAt < cutoffTime;
    });

    this.logger.info(
      { count: expiredUsers.length },
      'Found expired demo users to delete',
    );

    return expiredUsers;
  }

  private async deleteDemoUsers(
    adminClient: SupabaseClient,
    users: DemoUser[],
  ) {
    return Promise.allSettled(
      users.map(async (user: DemoUser) => {
        const { error } = await adminClient.auth.admin.deleteUser(user.id);

        if (error) {
          this.logger.error(
            { userId: user.id, err: error },
            'Failed to delete demo user',
          );
          throw error;
        }

        this.logger.info(
          { userId: user.id, email: user.email },
          'Demo user deleted successfully',
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
      'Demo users cleanup job completed',
    );
  }

  /**
   * Manual cleanup method (can be called from admin endpoint if needed)
   * Useful for testing or emergency cleanup
   */
  async cleanupDemoUsersByAge(maxAgeHours: number): Promise<{
    deleted: number;
    failed: number;
  }> {
    this.logger.info({ maxAgeHours }, 'Manual cleanup triggered');

    const adminClient = this.supabaseService.getServiceRoleClient();
    const cutoffTime = this.calculateCutoffTime(maxAgeHours);

    const expiredUsers = await this.findExpiredDemoUsers(
      adminClient,
      cutoffTime,
      true, // Manual cleanups should surface errors
    );

    const deleteResults = await this.deleteDemoUsers(adminClient, expiredUsers);

    const deleted = deleteResults.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failed = deleteResults.filter((r) => r.status === 'rejected').length;

    this.logger.info({ deleted, failed }, 'Manual cleanup completed');

    return { deleted, failed };
  }
}
