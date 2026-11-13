// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { layoutCalendarWeek } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

import CalendarTimeSlotAlternatives from '../../../src/components/calendar/CalendarTimeSlotAlternatives.svelte';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

import type { TimeSlotAlternative } from '@application/calendar/calendarTimeSlotAlternatives';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

function render(visibility: 'hidden' | 'visible', canRestore = true, locationLabel: string | null = null) {
  const start = '2026-11-02T10:00:00+02:00';
  const end = '2026-11-02T11:00:00+02:00';
  const segment = layoutCalendarWeek([fixed('alternative', start, end)], '2026-11-02').segments[0];
  const alternative: TimeSlotAlternative = {
    segment,
    presentation: { courseCode: 'CS-A1110', courseTitle: 'Test course', groupLabel: 'Exercise H01', locationLabel },
    hidden: visibility === 'hidden',
    canRestore,
  };
  const onRestore = vi.fn();
  const onHide = vi.fn();
  const onPreview = vi.fn();
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  mounted.push(mount(CalendarTimeSlotAlternatives, {
    target,
    props: {
      alternatives: [alternative],
      onRestore,
      onHide,
      onPreview,
    },
  }));
  flushSync();
  return { target, segment, onRestore, onHide, onPreview };
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targets.splice(0)) target.remove();
});

describe('Calendar time-slot alternative actions', () => {
  it('shows both time and location for overlapping alternatives', () => {
    const { target } = render('visible', true, 'Room A');
    const row = target.querySelector<HTMLButtonElement>('li button')!;
    expect(row.textContent).toContain('10:00–11:00');
    expect(row.textContent).toContain('Room A');
    expect(row.getAttribute('aria-label')).toContain('Room A');
  });

  it('clicks a visible event row to hide it', () => {
    const { target, segment, onHide, onRestore } = render('visible');
    const button = [...target.querySelectorAll<HTMLButtonElement>('li button')][0];
    expect(button.textContent).toContain('Visible');
    expect(button.classList.contains('concealed')).toBe(false);
    button.click();
    expect(onHide).toHaveBeenCalledExactlyOnceWith(segment);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('clicks a hidden event row to show it', () => {
    const { target, segment, onHide, onRestore } = render('hidden');
    const button = [...target.querySelectorAll<HTMLButtonElement>('li button')][0];
    expect(button.textContent).toContain('Hidden');
    expect(button.classList.contains('concealed')).toBe(true);
    expect(button.querySelector('.visibility-state')?.classList.contains('hidden')).toBe(true);
    button.click();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(segment);
    expect(onHide).not.toHaveBeenCalled();
  });

  it.each(['hidden', 'visible'] as const)('disables %s rows for ambiguous source identities', visibility => {
    const { target, onHide, onRestore } = render(visibility, false);
    const button = [...target.querySelectorAll<HTMLButtonElement>('li button')][0];
    expect(button.disabled).toBe(true);
    button.click();
    expect(onHide).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('previews hidden rows on keyboard focus without changing visibility', () => {
    const { target, segment, onPreview, onRestore, onHide } = render('hidden');
    const row = target.querySelector<HTMLButtonElement>('li button')!;
    row.dispatchEvent(new FocusEvent('focus'));
    expect(onPreview).toHaveBeenCalledWith(segment);
    row.dispatchEvent(new FocusEvent('blur'));
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onRestore).not.toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();
  });

  it('omits the preview and show-all buttons', () => {
    const { target } = render('hidden');
    expect(target.textContent).not.toContain('Preview hidden');
    expect(target.textContent).not.toContain('Show all hidden');
    expect(target.querySelectorAll('button')).toHaveLength(1);
  });
});
