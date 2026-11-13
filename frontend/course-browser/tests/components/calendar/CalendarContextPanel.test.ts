// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import CalendarContextPanel from '../../../src/components/calendar/CalendarContextPanel.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

import type { StudyEvent } from '@modules/study-groups';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

function render(locations: StudyEvent['locations'], fallback?: string) {
  const entry = fixed('room', '2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00');
  entry.source.event.locations = locations;
  entry.source.event.location = fallback;
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  mounted.push(mount(CalendarContextPanel, {
    target,
    props: {
      segment: layoutCalendarWeek([entry], '2026-11-02').segments[0],
      presentation: {
        courseCode: 'CS-E1234', courseTitle: 'Course A', groupLabel: 'Lecture L01',
        locationLabel: 'Old combined label',
      },
      date: '02.11.2026', isPinned: true, onClear: () => {},
    },
  }));
  flushSync();
  return target;
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targets.splice(0)) target.remove();
});

describe('Calendar context panel location rows', () => {
  it('shows labeled classroom and building rows', () => {
    const target = render([{ id: 'Y202a', name: 'Y202a', buildingName: 'Undergraduate Centre' }]);
    const rows = [...target.querySelectorAll<HTMLElement>('.location-row')];
    expect(rows.map(row => row.textContent?.trim())).toEqual(['Y202a', 'Undergraduate Centre']);
    expect(target.querySelector('dl')?.textContent).not.toContain('Old combined label');
    expect([...target.querySelectorAll('dl dt')].map(row => row.textContent?.trim())).toEqual(['Date', 'Time', 'Location', 'Building']);
  });

  it('omits building when none is provided', () => {
    const target = render([{ id: 'Y202a', name: 'Y202a' }]);
    expect([...target.querySelectorAll('.location-row')].map(row => row.textContent?.trim()))
      .toEqual(['Y202a']);
    expect(target.querySelector('dl')?.textContent).not.toContain('Building');
  });

  it('supports legacy free-text rooms without inferring a building', () => {
    const target = render([], 'Room B');
    expect([...target.querySelectorAll('.location-row')].map(row => row.textContent?.trim()))
      .toEqual(['Room B']);
  });

  it('deduplicates multiple classrooms and buildings', () => {
    const target = render([
      { id: 'a', name: 'Y202a', buildingName: 'Undergraduate Centre' },
      { id: 'b', name: 'Y202b', buildingName: 'Undergraduate Centre' },
    ]);
    expect([...target.querySelectorAll('.location-row')].map(row => row.textContent?.trim()))
      .toEqual(['Y202a, Y202b', 'Undergraduate Centre']);
  });
});
