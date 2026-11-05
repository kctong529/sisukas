
import { describe, expect, it } from 'vitest';
import {
  calendarEventPresentation,
  calendarGroupLabel,
  cleanCalendarCourseTitle,
  displayCalendarLocation,
  displayEventLocation,
  formatCalendarMinute,
} from '../../../src/application/calendar/calendarPresentation';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

describe('calendar presentation helpers', () => {
  it.each([
    [0, '00:00'],
    [615, '10:15'],
    [1439, '23:59'],
    [1440, '24:00'],
    [615.9, '10:15'],
  ] as const)(
    'formats wall minute %s as %s',
    (minute, label) => {
      expect(formatCalendarMinute(minute)).toBe(label);
    },
  );

  it('prefers legacy location and falls back to resolved room names', () => {
    const event = fixed(
      'a',
      '2026-11-02T10:00:00+02:00',
      '2026-11-02T11:00:00+02:00',
    ).source.event;

    event.location = '  Room A  ';
    event.locations = [{ id: '1', name: 'Room B' }];
    expect(displayEventLocation(event)).toBe('Room A');

    event.location = ' ';
    event.locations.push(
      { id: '2', name: 'Room B' },
      { id: '3', name: 'Room C' },
    );
    expect(displayEventLocation(event)).toBe('Room B, Room C');

    event.locations = [];
    expect(displayEventLocation(event)).toBeNull();
  });

  it('only removes a terminal redundant Contact teaching suffix', () => {
    expect(
      cleanCalendarCourseTitle('Software Quality, Contact teaching'),
    ).toBe('Software Quality');

    expect(
      cleanCalendarCourseTitle('Software Quality, Contact teaching extra'),
    ).toBe('Software Quality, Contact teaching extra');

    expect(
      cleanCalendarCourseTitle('Contact teaching methodology'),
    ).toBe('Contact teaching methodology');

    expect(
      cleanCalendarCourseTitle('  Design, contact teaching  '),
    ).toBe('Design');
  });

  it('preserves source group names, including nonstandard labels', () => {
    expect(
      calendarGroupLabel({
        studyGroupType: 'Exercise',
        studyGroupName: 'H02',
      }),
    ).toBe('Exercise H02');

    expect(
      calendarGroupLabel({
        studyGroupType: 'IT exercise',
        studyGroupName: 'A01',
      }),
    ).toBe('IT exercise A01');

    expect(
      calendarGroupLabel({
        studyGroupType: 'Small group teaching',
        studyGroupName: 'DATA SCIENCE',
      }),
    ).toBe('Small group teaching · DATA SCIENCE');

    expect(
      calendarGroupLabel({
        studyGroupType: 'Exercise',
        studyGroupName: 'En osallistu harjoituksiin',
      }),
    ).toBe('Exercise · En osallistu harjoituksiin');

    expect(
      calendarGroupLabel({
        studyGroupType: '',
        studyGroupName: 'YHTEISET',
      }),
    ).toBe('YHTEISET');

    expect(
      calendarGroupLabel({
        studyGroupType: '',
        studyGroupName: '',
      }),
    ).toBeNull();
  });

  it('combines building and room, de-duplicates, and handles partial locations', () => {
    const event = fixed(
      'b',
      '2026-11-02T10:00:00+02:00',
      '2026-11-02T11:00:00+02:00',
    ).source.event;

    event.location = 'Legacy Room';
    event.locations = [
      {
        id: '1',
        name: 'T3 - C206',
        buildingName: 'Computer Science building',
      },
      {
        id: '2',
        name: 'T3 - C206',
        buildingName: 'Computer Science building',
      },
      {
        id: '3',
        name: 'U157',
        buildingName: '',
      },
    ];

    expect(displayCalendarLocation(event)).toBe(
      'Computer Science building · T3 - C206, U157',
    );

    event.locations = [
      { id: '4', name: '', buildingName: 'Kide' },
    ];
    expect(displayCalendarLocation(event)).toBe('Kide');

    event.locations = [];
    expect(displayCalendarLocation(event)).toBe('Legacy Room');
  });

  it('builds a complete fallback presentation without inventing IDs or locations', () => {
    const source = fixed(
      'a',
      '2026-11-02T10:00:00+02:00',
      '2026-11-02T11:00:00+02:00',
    ).source;

    const info = calendarEventPresentation(source, undefined);

    expect(info).toMatchObject({
      courseCode: null,
      courseTitle: 'Course unavailable',
      groupLabel: null,
      locationLabel: null,
    });

    // Check displayed values, not object property names such as "groupLabel".
    const visibleText = [
      info.courseCode,
      info.courseTitle,
      info.groupLabel,
      info.locationLabel,
    ]
      .filter((value): value is string => value !== null)
      .join(' ');

    expect(visibleText).not.toContain(source.studyGroupId);
  });
});
