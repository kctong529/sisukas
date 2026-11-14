// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';

import WeekGrid from '../../../src/components/calendar/WeekGrid.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

import type { WeeklyCalendarSegment } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targets.splice(0)) target.remove();
  vi.restoreAllMocks();
});

it('shows time, classroom and building for overlapping events without visible selection labels', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); }),
  });
  const entries = ['a', 'b', 'c', 'd'].map(id => {
    const entry = fixed(id, '2026-11-02T10:00:00+02:00', '2026-11-02T11:00:00+02:00');
    entry.source.event.locations = [{ id: `Y${id}`, name: `Y${id}`, buildingName: 'Undergraduate Centre' }];
    return entry;
  });
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  mounted.push(mount(WeekGrid, {
    target,
    props: {
      layout: layoutCalendarWeek(entries, '2026-11-02'),
      presentationForSegment: (segment: WeeklyCalendarSegment) => ({
          courseCode: null,
          courseTitle: segment.entry.source.studyGroupId,
          groupLabel: 'Exercise H01',
          locationLabel: null,
      }),
    },
  }));
  flushSync();
  target.querySelector<HTMLButtonElement>('.cluster button')?.click();
  flushSync();
  const item = target.querySelector<HTMLElement>('dialog.event-details > ul > li');
  expect(item).not.toBeNull();
  const labels = [...item!.querySelectorAll('dl dt')].map(node => node.textContent?.trim());
  expect(labels).toEqual(['Time', 'Location', 'Building']);
  expect(item?.textContent).toContain('10:00–11:00');
  expect(item?.textContent).toContain('Undergraduate Centre');
  expect(item?.querySelector('[data-selection="candidate"]')).not.toBeNull();
  expect(item?.querySelector('[data-selection="candidate"]')?.classList.contains('visually-hidden')).toBe(true);
});
