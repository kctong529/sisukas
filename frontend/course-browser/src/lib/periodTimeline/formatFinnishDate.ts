/** Formats a calendar date using Sisukas' DD.MM.YYYY convention.
 * Read the local calendar fields rather than converting to UTC.
 */
export function formatFinnishDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}
