import { GRACE_PERIOD_DAYS } from './account-deletion.entity';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class AccountDeletionInvariants {
  static parseScheduledDate(scheduledAt: string | undefined): Date | null {
    if (!scheduledAt) return null;
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) return null;
    return scheduledDate;
  }

  static isGracePeriodExpired(scheduledAt: Date, now: Date): boolean {
    const expirationDate = new Date(
      scheduledAt.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY,
    );
    return now >= expirationDate;
  }
}
