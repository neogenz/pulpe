import { format } from 'date-fns';
import { tz } from '@date-fns/tz';

/**
 * Fuseau IANA par défaut pour les dates « métier » Pulpe (CH, aligné Frankfurter / ECB).
 * Quand une valeur par environnement sera nécessaire, la lire via `ConfigService` et la passer à `formatBusinessCalendarDate`.
 */
export const DEFAULT_BUSINESS_TIMEZONE = 'Europe/Zurich' as const;

/**
 * Jour civil au format `YYYY-MM-DD` dans le fuseau donné.
 *
 * - **À utiliser pour** : date de cours, date comptable sans heure, libellés « jour » (pas un instant précis).
 * - **Ne pas utiliser pour** : horodatages API (`createdAt`, etc.) → préférer ISO 8601 UTC (`toISOString()` ou `formatISO` avec contexte UTC).
 *
 * Implémentation : `date-fns` v4 + `@date-fns/tz` (recommandation officielle pour les fuseaux).
 */
export function formatBusinessCalendarDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  return format(date, 'yyyy-MM-dd', { in: tz(timeZone) });
}
