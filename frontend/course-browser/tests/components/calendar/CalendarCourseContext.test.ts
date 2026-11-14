import { flushSync, mount, unmount } from 'svelte';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';
import { layoutCalendarWeek, type WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';

import CalendarCourseContext from '../../../src/components/calendar/CalendarCourseContext.svelte';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';

const instances: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];
const occurrence = fixed('occ-1', '2026-11-02T10:15:00+02:00', '2026-11-02T11:45:00+02:00');
const segment = layoutCalendarWeek([occurrence], '2026-11-02').segments[0];
const course: CalendarWeekCourse = {
  offeringId: 'offering', code: 'CS-1000', title: 'Course title',
  course: {} as CalendarWeekCourse['course'],
};
function render(override: 'visible' | 'hidden' | null, pinned = true) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  const onToggleOccurrence = vi.fn();
  const onClear = vi.fn();
  const onGroupPreview = vi.fn();
  const onOccurrencePreview = vi.fn();
  instances.push(mount(CalendarCourseContext, {
    target,
    props: {
      course, isPinned: pinned, groups: [
        { groupId: 'group', name: 'H01', type: 'Exercise', studyEvents: [] },
        { groupId: 'lecture', name: 'L01', type: 'Lecture', studyEvents: [] },
        { groupId: 'exam', name: 'KT', type: 'Exam', studyEvents: [] },
      ],
      segments: [segment],
      visibility: {
        hiddenGroups: [calendarGroupKey('offering', 'group')],
        occurrenceOverrides: override ? { 'occ-1': override } : {},
      },
      membersForSegment: (item: WeeklyCalendarSegment) => [item.entry],
      onToggleGroup: vi.fn(), onToggleOccurrence, onClear, onGroupPreview, onOccurrencePreview,
    },
  }));
  flushSync();
  return { target, onToggleOccurrence, onClear, onGroupPreview, onOccurrencePreview };
}
afterEach(async () => {
  for (const instance of instances.splice(0)) await unmount(instance);
  for (const target of targets.splice(0)) target.remove();
});

describe('course context compact visibility controls', () => {
  it('cycles explicitly shown -> inherited with one click', () => {
    const { target, onToggleOccurrence } = render('visible');
    const button = target.querySelector<HTMLButtonElement>('.occurrence')!;
    expect(button.getAttribute('aria-label')).toContain('Explicitly shown');
    button.click();
    expect(onToggleOccurrence).toHaveBeenCalledWith(segment, null);
  });
  it('cycles inherited -> hidden with one click', () => {
    const { target, onToggleOccurrence } = render(null);
    const button = target.querySelector<HTMLButtonElement>('.occurrence')!;
    expect(button.getAttribute('aria-label')).toContain('Inherited from group');
    expect(button.classList.contains('dimmed')).toBe(true);
    button.click();
    expect(onToggleOccurrence).toHaveBeenCalledWith(segment, 'hidden');
  });
  it('cycles hidden -> explicitly shown with one click', () => {
    const { target, onToggleOccurrence } = render('hidden');
    target.querySelector<HTMLButtonElement>('.occurrence')?.click();
    expect(onToggleOccurrence).toHaveBeenCalledWith(segment, 'visible');
  });
  it('previews groups and occurrences without changing visibility', () => {
    const { target, onGroupPreview, onOccurrencePreview, onToggleOccurrence } = render(null);
    const group = [...target.querySelectorAll<HTMLElement>('.group[role="group"]')]
      .find(card => card.querySelector('.group-preview')?.textContent?.trim() === 'H01')!;
    group.dispatchEvent(new Event('pointerenter'));
    group.dispatchEvent(new Event('pointerleave'));
    const occurrenceButton = target.querySelector<HTMLButtonElement>('.occurrence')!;
    occurrenceButton.dispatchEvent(new Event('pointerenter'));
    occurrenceButton.dispatchEvent(new Event('pointerleave'));
    expect(onGroupPreview).toHaveBeenCalledWith('group');
    expect(onGroupPreview).toHaveBeenCalledWith(null);
    expect(onOccurrencePreview).toHaveBeenCalledWith(segment.id);
    expect(onOccurrencePreview).toHaveBeenCalledWith(null);
    expect(onToggleOccurrence).not.toHaveBeenCalled();
    expect(target.querySelector('summary')).toBeNull();
  });
  it('groups teaching groups by type without repeating empty-week messages', () => {
    const { target } = render(null);
    const headings = [...target.querySelectorAll('.group-type h5')].map(node => node.textContent);
    expect(headings).toEqual(['Lectures', 'Exercises', 'Exams']);
    expect(target.textContent).not.toContain('No occurrences this week');
    expect(target.querySelectorAll('.group-preview')).toHaveLength(3);
    expect(target.querySelectorAll('.occurrence')).toHaveLength(1);
  });
  it('uses the entire group card as the toggle surface while preserving independent occurrence buttons', () => {
    const { target, onToggleOccurrence } = render(null);
    const exercise = [...target.querySelectorAll<HTMLElement>('.group')]
      .find(card => card.querySelector('.group-preview')?.textContent?.trim() === 'H01')!;
    const groupButton = exercise.querySelector<HTMLButtonElement>('.group-preview')!;
    const occurrenceButton = exercise.querySelector<HTMLButtonElement>('.occurrence')!;
    expect(groupButton.parentElement).toBe(exercise);
    expect(occurrenceButton.parentElement).toBe(exercise);
    expect(groupButton.contains(occurrenceButton)).toBe(false);
    expect(exercise.querySelector('.group-label-space')).not.toBeNull();
    groupButton.click();
    expect(onToggleOccurrence).not.toHaveBeenCalled();
    occurrenceButton.click();
    expect(onToggleOccurrence).toHaveBeenCalledWith(segment, 'hidden');
  });
  it('rounds occurrence chips outward to hours and retains exact times accessibly', () => {
    const { target } = render(null);
    const button = target.querySelector<HTMLButtonElement>('.occurrence')!;
    expect(button.textContent?.trim()).toBe('Mon 10-12');
    expect(button.getAttribute('aria-label')).toContain('10:15–11:45');
    expect(button.title).toContain('10:15–11:45');
    expect(button.textContent).not.toContain('Inherited');
    expect(button.textContent).not.toContain('Nov');
  });
  it('uses distinct visual treatment for explicit hidden and shown overrides', () => {
    const hidden = render('hidden').target.querySelector<HTMLButtonElement>('.occurrence')!;
    const shown = render('visible').target.querySelector<HTMLButtonElement>('.occurrence')!;
    expect(hidden.classList.contains('override-hidden')).toBe(true);
    expect(shown.classList.contains('override-shown')).toBe(true);
  });
  it('shares panel heading and code alignment with event details', () => {
    const { target } = render(null, false);
    expect(target.querySelector('.context-panel h2')?.textContent).toBe('Course details');
    expect(target.querySelector<HTMLButtonElement>('.context-panel button.clear')?.disabled).toBe(true);
    expect(target.querySelector('.course-identity .code')?.textContent).toBe('CS-1000');
    expect(target.textContent).toContain('Previewing');
  });
});
