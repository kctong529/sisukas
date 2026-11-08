import { flushSync, mount, unmount } from 'svelte';
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import CalendarEvent from '../../../src/components/calendar/CalendarEvent.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];
function render(start: string, end: string, options: { cancelled?: boolean; excluded?: boolean; selection?: "selected" | "candidate" } = {}) {
  const entry = fixed('a', start, end, options);
  entry.source.event.location = 'Room A';
  const segments = layoutCalendarWeek([entry], '2026-11-02').segments;
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  mounted.push(mount(CalendarEvent, { target, props: { segment: segments[0], selection: options.selection, presentation: { courseCode: 'CS-E1234', courseTitle: 'Course A', groupLabel: 'Lecture L01', locationLabel: 'Room A' } } }));
  flushSync();
  return target;
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targets.splice(0)) target.remove();
});

describe('CalendarEvent presentation', () => {
  it('shows source title, time and location for a normal event', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00');
    expect(target.textContent).toContain('CS-E1234');
    expect(target.textContent).toContain('Course A');
    expect(target.textContent).toContain('Lecture L01');
    expect(target.querySelector('.calendar-event')?.getAttribute('aria-label')).toContain('Lecture L01');
    expect(target.textContent).toContain('10:00–11:00');
    expect(target.textContent).toContain('Room A');
  });
  it('preserves technical group identity without showing it as card text', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00');
    const description = target.querySelector('.calendar-event')?.getAttribute('aria-label') ?? '';
    expect(description).toContain('Lecture L01');
    expect(description).not.toContain('aalto-ssg-');
    expect(target.querySelector('.event-title')?.textContent?.trim()).toBe('Course A');
  });
  it('keeps short events compact without losing their accessible label', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T10:15:00+02:00');
    expect(target.querySelector('[data-compact="true"]')).not.toBeNull();
    expect(target.querySelector('.event-time')).toBeNull();
    expect(target.querySelector('[aria-label]')?.getAttribute('aria-label')).toContain('10:00–10:15');
  });
  it('labels candidate events without suggesting a confirmed selection', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00');
    expect(target.querySelector('[data-selection="candidate"]')).not.toBeNull();
    expect(target.textContent).toContain('Candidate · not selected in Sisukas');
    expect(target.querySelector('.calendar-event')?.getAttribute('aria-label')).toContain('Candidate');
  });
  it('labels explicit Sisukas choices but does not claim SISU registration', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00', { selection: 'selected' });
    expect(target.querySelector('[data-selection="selected"]')).not.toBeNull();
    expect(target.textContent).toContain('Selected in Sisukas');
    expect(target.textContent).not.toContain('Registered');
  });
  it('marks cancelled events explicitly', () => {
    const target = render('2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00', { cancelled: true });
    expect(target.querySelector('.event-status')?.textContent).toContain('Cancelled');
    expect(target.querySelector('[aria-label]')?.getAttribute('aria-label')).toContain('Cancelled');
  });
  it('indicates midnight continuation rather than changing the source interval', () => {
    const target = render('2026-11-02T23:00:00+02:00', '2026-11-03T01:00:00+02:00');
    expect(target.textContent).toContain('↦');
    expect(target.querySelector('[aria-label]')?.getAttribute('aria-label')).toContain('Continues later');
  });
});
