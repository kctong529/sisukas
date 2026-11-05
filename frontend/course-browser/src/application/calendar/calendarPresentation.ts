import type { StudyEvent } from '@domain/models/StudyEvent';

/** Display-only wall-clock minutes supplied by the weekly layout engine. */
export function formatCalendarMinute(minute: number): string {
  const whole = Math.floor(minute);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** Prefer the original display location, then a resolved room label. */
export function displayEventLocation(event: StudyEvent): string | null {
  const legacy = event.location?.trim();
  if (legacy) return legacy;
  const resolved = event.locations.map(location => location.name.trim()).filter(Boolean);
  return resolved.length > 0 ? [...new Set(resolved)].join(', ') : null;
}
