/**
 * The date of an entry, as « Mon patrimoine » and the detail say it:
 * « 3 novembre » this year, « 3 novembre 2025 » for an earlier year, and
 * « 1er novembre » on the first of the month in French.
 */
export function formatEntryDate(recordedAt: string, locale: string): string {
  const date = new Date(recordedAt);
  const isFrench = locale.toLowerCase().startsWith('fr');
  return (
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year:
        date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    })
      .formatToParts(date)
      .map(({ type, value }) =>
        isFrench && type === 'day' && value === '1' ? '1er' : value,
      )
      .join('')
      // Keeps « 24 novembre » on one line on a phone.
      .replaceAll(' ', ' ')
  );
}
