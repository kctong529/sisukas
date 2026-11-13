// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';

import CalendarCourseContext from '../../../src/components/calendar/CalendarCourseContext.svelte';

import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

function render() {
  const target = document.createElement('div');
  document.body.append(target);
  targets.push(target);
  const onChooseGroup = vi.fn();
  const onShowAll = vi.fn();
  const course: CalendarWeekCourse = {
    offeringId: 'offer', code: 'CS-1000', title: 'Course',
    course: {} as CalendarWeekCourse['course'],
  };
  mounted.push(mount(CalendarCourseContext, {
    target,
    props: {
      course,
      isPinned: true,
      groups: [
        { groupId: 'e1', name: 'H01', type: 'Exercise', studyEvents: [] },
        { groupId: 'e2', name: 'H02', type: 'Exercise', studyEvents: [] },
        { groupId: 'l1', name: 'L01', type: 'Lecture', studyEvents: [] },
      ],
      segments: [],
      visibility: { hiddenGroups: [calendarGroupKey('offer', 'e2')], occurrenceOverrides: {} },
      membersForSegment: () => [],
      onToggleGroup: vi.fn(), onToggleOccurrence: vi.fn(),
      onChooseGroup, onShowAll, onClear: vi.fn(),
    },
  }));
  flushSync();
  return { target, onChooseGroup, onShowAll };
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const element of targets.splice(0)) element.remove();
});

describe('Calendar group shortcuts (#101)', () => {
  it('shows Only for equivalent exercises, not for a single lecture', () => {
    const { target, onChooseGroup } = render();
    const buttons = [...target.querySelectorAll<HTMLButtonElement>('.choose-group')];
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    expect(onChooseGroup).toHaveBeenCalledWith('offer', 'e1', [
      { groupId: 'e1', type: 'Exercises' },
      { groupId: 'e2', type: 'Exercises' },
      { groupId: 'l1', type: 'Lectures' },
    ]);
  });

  it('provides an enabled Show all action for a hidden group', () => {
    const { target, onShowAll } = render();
    const button = target.querySelector<HTMLButtonElement>('.show-all')!;
    expect(button.disabled).toBe(false);
    button.click();
    expect(onShowAll).toHaveBeenCalledWith('offer');
  });
});
