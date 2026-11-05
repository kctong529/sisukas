/** Presentation-only labels for the ISO dates supplied by the weekly layout. */
export function calendarDayHeading(isoDate: string): {
  weekday: string;
  date: string;
  fullDate: string;
} {
  // Use UTC noon so formatting never depends on the viewer's local timezone.
  const instant = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(instant.getTime()) ||
      instant.toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError(`Invalid calendar day: ${isoDate}`);
  }
  return {
    weekday: new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', timeZone: 'UTC',
    }).format(instant),
    date: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    }).format(instant),
    fullDate: new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'UTC',
    }).format(instant),
  };
}
