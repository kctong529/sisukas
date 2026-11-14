/** Status of a course offering relative to the Helsinki calendar day. */
export type OfferingTiming = 'past' | 'current' | 'future';

const helsinkiDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dayKey(date: Date): number {
  const parts = helsinkiDay.formatToParts(date);
  const get = (name: string) => Number(parts.find(part => part.type === name)?.value);
  return get('year') * 10000 + get('month') * 100 + get('day');
}

/** Inclusive start/end dates: a course ending today is still current. */
export function offeringTiming(start: Date, end: Date, today: Date = new Date()): OfferingTiming {
  const current = dayKey(today);
  if (dayKey(end) < current) return 'past';
  if (dayKey(start) > current) return 'future';
  return 'current';
}
