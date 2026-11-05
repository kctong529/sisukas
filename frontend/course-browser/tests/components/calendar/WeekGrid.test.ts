// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import WeekGrid from '../../../src/components/calendar/WeekGrid.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

const mounted: Array<ReturnType<typeof mount>> = [];
const targetElements: HTMLElement[] = [];
function render(entries: ReturnType<typeof fixed>[]) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targetElements.push(target);
  const layout = layoutCalendarWeek(entries, '2026-11-02');
  mounted.push(mount(WeekGrid, { target, props: { layout, labelForSegment: (s) => s.entry.source.studyGroupId } }));
  flushSync();
  return target;
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targetElements.splice(0)) target.remove();
});

describe('WeekGrid walking skeleton', () => {
  it('renders seven day columns even for an empty week', () => {
    const target = render([]);
    expect(target.querySelectorAll('.day-column')).toHaveLength(7);
    expect(target.querySelectorAll('.event')).toHaveLength(0);
  });

  it('renders projected occurrences and keeps distinct associations', () => {
    const target = render([
      fixed('a', '2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00', { group: 'Group A' }),
      fixed('b', '2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00', { group: 'Group B' }),
    ]);
    expect(target.querySelectorAll('.event')).toHaveLength(2);
    expect(target.textContent).toContain('Group A');
    expect(target.textContent).toContain('Group B');
    const events = [...target.querySelectorAll<HTMLElement>('.event')];
    expect(events[0].style.left).not.toEqual(events[1].style.left);
  });
});
