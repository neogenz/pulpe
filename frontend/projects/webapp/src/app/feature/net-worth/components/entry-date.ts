/**
 * The date of an entry, as « Mon patrimoine » and the detail say it:
 * « 3 novembre » this year, « 3 novembre 2025 » for an earlier year, and
 * « 1er novembre » / « 1º novembre » on the first of the month in French and
 * Italian, as on iOS and Android.
 */
const FIRST_DAY: Partial<Record<string, string>> = { fr: '1er', it: '1º' };

export function formatEntryDate(recordedAt: string, locale: string): string {
  const date = new Date(recordedAt);
  const firstDay = FIRST_DAY[locale.slice(0, 2).toLowerCase()];
  return (
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year:
        date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    })
      .formatToParts(date)
      .map(({ type, value }) =>
        firstDay && type === 'day' && value === '1' ? firstDay : value,
      )
      .join('')
      // Keeps « 24 novembre » on one line on a phone.
      .replaceAll(' ', ' ')
  );
}
