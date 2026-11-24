/**
 * The date of my last entry, as the row and the edit dialog both say it:
 * « 3 novembre » this year, « 3 novembre 2025 » for an earlier year.
 */
export function formatEntryDate(recordedAt: string, locale: string): string {
  const date = new Date(recordedAt);
  return (
    date
      .toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year:
          date.getFullYear() === new Date().getFullYear()
            ? undefined
            : 'numeric',
      })
      // Keeps « 24 novembre » on one line on a phone.
      .replaceAll(' ', ' ')
  );
}
