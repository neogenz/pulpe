import { PAY_DAY_MIN, PAY_DAY_MAX } from 'pulpe-shared';

/**
 * `payDayOfMonth` lu depuis `auth.users.user_metadata`, borné, ou `null` quand
 * il n'est pas exploitable — `getBudgetPeriodForDate` traite `null` comme le
 * comportement calendaire.
 *
 * Les guards l'appellent sur l'utilisateur qu'ils viennent de charger, pour que
 * la donnée voyage dans `AuthenticatedUser` : toute lecture ultérieure serait un
 * appel GoTrue redondant dans la même requête.
 */
export function resolvePayDayOfMonth(metadata: unknown): number | null {
  const raw = (metadata as { payDayOfMonth?: unknown } | null | undefined)
    ?.payDayOfMonth;

  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;

  return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
}
