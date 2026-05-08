import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AccountDeletionRepositoryPort } from '../../domain/ports/account-deletion-repository.port';
import { AccountDeletionInvariants } from '../../domain/account-deletion.invariants';
import type { ScheduledDeletionUser } from '../../domain/account-deletion.entity';

const PER_PAGE = 1000;
const MAX_PAGES = 100;

@Injectable()
export class SupabaseAccountDeletionRepository implements AccountDeletionRepositoryPort {
  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectInfoLogger(SupabaseAccountDeletionRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async listExpiredScheduledUsers(now: Date): Promise<ScheduledDeletionUser[]> {
    const adminClient = this.supabaseService.getServiceRoleClient();
    const expiredUsers: ScheduledDeletionUser[] = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });

      if (error) {
        this.logger.warn(
          { err: error, page },
          'Failed to list users for scheduled deletion cleanup',
        );
        break;
      }

      const usersOnPage = (data?.users ?? []) as ScheduledDeletionUser[];
      expiredUsers.push(...this.#filterExpired(usersOnPage, now));

      if (usersOnPage.length < PER_PAGE) break;
      page += 1;
    }

    return expiredUsers;
  }

  async deleteUser(userId: string): Promise<void> {
    const adminClient = this.supabaseService.getServiceRoleClient();
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  #filterExpired(
    users: ScheduledDeletionUser[],
    now: Date,
  ): ScheduledDeletionUser[] {
    return users.filter((user) => {
      const scheduledAt = AccountDeletionInvariants.parseScheduledDate(
        user.user_metadata?.scheduledDeletionAt,
      );
      if (!scheduledAt) {
        if (user.user_metadata?.scheduledDeletionAt !== undefined) {
          this.logger.warn(
            {
              userId: user.id,
              scheduledAt: user.user_metadata?.scheduledDeletionAt,
            },
            'Invalid scheduledDeletionAt date format',
          );
        }
        return false;
      }
      return AccountDeletionInvariants.isGracePeriodExpired(scheduledAt, now);
    });
  }
}
