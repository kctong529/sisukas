// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import WeekGrid from '../../../src/components/calendar/WeekGrid.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

const mounted: Array<ReturnType<typeof mount>> = [];
const targetElements: HTMLElement[] = [];
const at = (hour: number) => `2026-11-02T${String(hour).padStart(2, '0')}:00:00+02:00`;
const event = (id: string, start = 10, end = 11) =>
  fixed(id, at(start), at(end), { group: `Group ${id}` });

function render(entries: ReturnType<typeof fixed>[]) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targetElements.push(target);
  const layout = layoutCalendarWeek(entries, '2026-11-02');
  mounted.push(mount(WeekGrid, {
    target,
    props: { layout, labelForSegment: (segment) => segment.entry.source.studyGroupId },
  }));
  flushSync();
  return target;
}

beforeEach(() => {
  // jsdom does not implement native modal display; test the markup and handler.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); }),
  });
});

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targetElements.splice(0)) target.remove();
  vi.restoreAllMocks();
});

describe('WeekGrid dense overlap disclosure', () => {
  it('renders seven day columns even for an empty week', () => {
    const target = render([]);
    expect(target.querySelectorAll('.day-column')).toHaveLength(7);
    expect(target.querySelectorAll('.event')).toHaveLength(0);
  });

  it('keeps three concurrent source associations in separate columns', () => {
    const target = render([event('a'), event('b'), event('c')]);
    expect(target.querySelectorAll('.event')).toHaveLength(3);
    expect(target.querySelector('.cluster')).toBeNull();
    const events = [...target.querySelectorAll<HTMLElement>('.event')];
    expect(new Set(events.map(element => element.style.left)).size).toBe(3);
  });

  it('shows a disclosure control for four concurrent associations', () => {
    const target = render([event('a'), event('b'), event('c'), event('d')]);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(4);
    const button = target.querySelector<HTMLButtonElement>('.cluster button');
    expect(button?.getAttribute('aria-label')).toContain('View 4 events in busy period');
    expect(button?.getAttribute('aria-label')).toContain('10:00–11:00');
    button?.click();
    flushSync();
    expect(target.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    const listed = [...target.querySelectorAll('.event-details li')].map(li => li.textContent);
    expect(listed).toHaveLength(4);
    for (const id of ['a', 'b', 'c', 'd']) expect(listed.join(' ')).toContain(`Group ${id}`);
  });

  it('discloses dense-interval members and preserves other events', () => {
    const entries = [event('a', 10, 12), event('b', 10, 12),
      event('c', 10, 12), event('d', 10, 12), event('e', 11, 13),
      event('later', 15, 16), fixed('cancelled', at(10), at(12), { cancelled: true })];
    const target = render(entries);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(7);
    target.querySelector<HTMLButtonElement>('.cluster button')?.click();
    flushSync();
    expect(target.querySelectorAll('.event-details li')).toHaveLength(5);
    expect(target.querySelector('.event-details')?.textContent).toContain('10:00–12:00');
    expect(target.textContent).toContain('Group later');
  });


  it('keeps a long event as one card while marking only its busy interval', () => {
    const target = render([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 12),
    ]);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    const cluster = target.querySelector<HTMLElement>('.cluster');
    expect(cluster?.style.top).toBe(`${600 / 1440 * 100}%`);
    expect(cluster?.style.height).toBe('');
    const longCard = target.querySelector<HTMLElement>('.event[data-segment-id]');
    expect(target.querySelectorAll('.event')).toHaveLength(4);
    expect(longCard).toBeTruthy();
    expect(longCard?.getAttribute('data-segment-id')).not.toContain(':visible:');
  });

  it('preserves distinct simultaneous associations when not dense', () => {
    const target = render([event('a'), event('b')]);
    expect(target.querySelectorAll('.event')).toHaveLength(2);
    expect(target.textContent).toContain('Group a');
    expect(target.textContent).toContain('Group b');
  });
});
