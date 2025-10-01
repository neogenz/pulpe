import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';

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
   * Cleanup job that runs every 6 hours
   * Deletes demo users created more than 24 hours ago
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

      // Calculate the cutoff timestamp (24 hours ago)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24);

      this.logger.info(
        { cutoffTime: cutoffTime.toISOString() },
        'Cutoff time calculated',
      );

      // Query all users (Admin API doesn't allow direct filtering by metadata)
      // We need to fetch and filter in application code
      const { data: allUsers, error: listError } =
        await adminClient.auth.admin.listUsers({
          perPage: 1000, // Adjust if you expect more demo users
        });

      if (listError) {
        this.logger.error(
          { error: listError },
          'Failed to list users for cleanup',
        );
        return;
      }

      // Filter for demo users older than 24 hours
      const expiredDemoUsers = allUsers.users.filter((user) => {
        const isDemo = user.user_metadata?.is_demo === true;
        if (!isDemo) return false;

        const createdAt = new Date(user.created_at);
        return createdAt < cutoffTime;
      });

      if (expiredDemoUsers.length === 0) {
        this.logger.info('No expired demo users to cleanup');
        return;
      }

      this.logger.info(
        { count: expiredDemoUsers.length },
        'Found expired demo users to delete',
      );

      // Delete each expired demo user
      const deleteResults = await Promise.allSettled(
        expiredDemoUsers.map(async (user) => {
          const { error } = await adminClient.auth.admin.deleteUser(user.id);

          if (error) {
            this.logger.error(
              { userId: user.id, error },
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

      // Count successes and failures
      const successCount = deleteResults.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failureCount = deleteResults.filter(
        (r) => r.status === 'rejected',
      ).length;

      this.logger.info(
        {
          total: expiredDemoUsers.length,
          succeeded: successCount,
          failed: failureCount,
          duration: Date.now() - startTime,
        },
        'Demo users cleanup job completed',
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          duration: Date.now() - startTime,
        },
        'Demo users cleanup job failed',
      );
    }
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
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    const { data: allUsers, error: listError } =
      await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      throw listError;
    }

    const expiredDemoUsers = allUsers.users.filter((user) => {
      const isDemo = user.user_metadata?.is_demo === true;
      if (!isDemo) return false;

      const createdAt = new Date(user.created_at);
      return createdAt < cutoffTime;
    });

    const deleteResults = await Promise.allSettled(
      expiredDemoUsers.map(async (user) => {
        const { error } = await adminClient.auth.admin.deleteUser(user.id);
        if (error) throw error;
      }),
    );

    const deleted = deleteResults.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failed = deleteResults.filter((r) => r.status === 'rejected').length;

    this.logger.info({ deleted, failed }, 'Manual cleanup completed');

    return { deleted, failed };
  }
}
