<script lang="ts">
  import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { StudyGroup } from '@modules/study-groups/models/StudyGroup';
  import type { CalendarVisibility } from '@application/calendar/calendarVisibility';
  import { calendarGroupKey, calendarEntryVisible } from '@application/calendar/calendarVisibility';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  import CalendarDetailsHeading from './CalendarDetailsHeading.svelte';
  interface Props {
    course: CalendarWeekCourse;
    isPinned: boolean;
    groups: readonly StudyGroup[];
    segments: readonly WeeklyCalendarSegment[];
    visibility: CalendarVisibility;
    membersForSegment: (segment: WeeklyCalendarSegment) => readonly import('@domain/models/CalendarEntry').CalendarEntry[];
    onToggleGroup: (offeringId: string, groupId: string, hidden: boolean) => void;
    onToggleOccurrence: (segment: WeeklyCalendarSegment, state: 'hidden' | 'visible' | null) => void;
    onClear: () => void;
    onGroupPreview?: (groupId: string | null) => void;
    onOccurrencePreview?: (segmentId: string | null) => void;
  }
  let { course, isPinned, groups, segments, visibility, membersForSegment, onToggleGroup, onToggleOccurrence, onClear,
    onGroupPreview = () => {}, onOccurrencePreview = () => {} }: Props = $props();
  const groupIds = $derived([...new Set([
    ...groups.map(group => group.groupId),
    ...segments.map(segment => segment.entry.source.studyGroupId),
  ])]);
  const groupDetails = $derived(groupIds.map(groupId => {
    const source = groups.find(group => group.groupId === groupId);
    const occurrences = segments.filter(segment => segment.entry.source.studyGroupId === groupId);
    const first = occurrences[0]?.entry.source;
    return {
      id: groupId, name: source?.name || first?.studyGroupName || groupId,
      type: source?.type || first?.studyGroupType || 'Other',
      occurrences, hidden: visibility.hiddenGroups.includes(calendarGroupKey(course.offeringId, groupId)),
    };
  }).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
  function isVisible(segment: WeeklyCalendarSegment): boolean {
    return membersForSegment(segment).some(entry => calendarEntryVisible(entry, visibility));
  }
  function mayChange(segment: WeeklyCalendarSegment): boolean {
    return membersForSegment(segment).every(entry => entry.occurrenceKey !== null);
  }
  function overrideFor(segment: WeeklyCalendarSegment): 'visible' | 'hidden' | 'mixed' | null {
    const members = membersForSegment(segment);
    if (members.some(entry => entry.occurrenceKey === null)) return null;
    const states = members.map(entry => Object.hasOwn(visibility.occurrenceOverrides, entry.occurrenceKey!)
      ? visibility.occurrenceOverrides[entry.occurrenceKey!] : null);
    return states.every(state => state === states[0]) ? states[0] : 'mixed';
  }
  // Inherited -> hidden -> explicitly shown -> inherited. A mixed
  // multi-room display occurrence first normalizes to hidden.
  function nextOverride(segment: WeeklyCalendarSegment): 'hidden' | 'visible' | null {
    const state = overrideFor(segment);
    if (state === 'hidden') return 'visible';
    if (state === 'visible') return null;
    return 'hidden';
  }
  function overrideDescription(segment: WeeklyCalendarSegment): string {
    const state = overrideFor(segment);
    return state === null ? 'Inherited from group'
      : state === 'mixed' ? 'Mixed source overrides'
      : state === 'hidden' ? 'Explicitly hidden' : 'Explicitly shown';
  }
  function nextDescription(segment: WeeklyCalendarSegment): string {
    const state = nextOverride(segment);
    return state === null ? 'reset to inherited visibility' : `set explicitly ${state}`;
  }
  // The timetable is already scoped to a week. The chip is deliberately
  // approximate; the accessible name and tooltip retain exact times.
  const weekday = (segment: WeeklyCalendarSegment) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki', weekday: 'short',
  }).format(new Date(segment.entry.interval.startMs));
  const exactTime = (segment: WeeklyCalendarSegment) =>
    `${formatCalendarMinute(segment.startMinute)}–${formatCalendarMinute(segment.endMinute)}`;
  const hourRange = (segment: WeeklyCalendarSegment) =>
    `${Math.floor(segment.startMinute / 60)}-${Math.ceil(segment.endMinute / 60)}`;
  function typeHeading(type: string): string {
    const normalized = type.trim().toLocaleLowerCase();
    if (normalized.includes('exam') || normalized.includes('tentti')) return 'Exams';
    if (normalized.includes('lecture') || normalized.includes('luento')) return 'Lectures';
    if (normalized.includes('exercise') || normalized.includes('harjoitus')) return 'Exercises';
    if (normalized.includes('seminar')) return 'Seminars';
    if (normalized.includes('lab')) return 'Laboratories';
    return type.trim() || 'Other';
  }
  const groupedDetails = $derived.by(() => {
    const sections = new Map<string, typeof groupDetails>();
    for (const group of groupDetails) {
      const heading = typeHeading(group.type);
      if (!sections.has(heading)) sections.set(heading, []);
      sections.get(heading)!.push(group);
    }
    const order = ['Lectures', 'Exercises', 'Exams', 'Seminars', 'Laboratories'];
    return [...sections].sort(([a], [b]) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    }).map(([heading, items]) => ({ heading, groups: items }));
  });
</script>
<aside class="context-panel course-context" aria-labelledby="course-context-title">
  <CalendarDetailsHeading kind="Course" titleId="course-context-title"
    code={course.code} title={course.title} {isPinned} {onClear} />
  <div class="course-information">
    {#if !isPinned}<p class="hint">Previewing · Click the course to pin its details here.</p>{/if}
    <p class="help">Manage timetable visibility only. These controls do not change attendance or registration.</p>
    <h4>Teaching groups</h4>
    {#if groupedDetails.length}
      {#each groupedDetails as section (section.heading)}
        <section class="group-type" aria-label={section.heading}>
          <h5>{section.heading}</h5>
          {#each section.groups as group (group.id)}
            <div class="group" role="group" aria-label={`${group.name}, ${group.type}`}
              onpointerenter={() => onGroupPreview(group.id)}
              onpointerleave={() => onGroupPreview(null)}>
              <button type="button" class="group-preview" class:group-hidden={group.hidden}
                  aria-pressed={group.hidden}
                  aria-label={`${group.name}, ${group.type}, ${group.hidden ? 'hidden' : 'visible'}. Click to ${group.hidden ? 'show' : 'hide'} group; hover or focus to highlight its visible events this week.`}
                  title={`${group.name} · ${group.hidden ? 'Hidden' : 'Visible'} · Click to ${group.hidden ? 'show' : 'hide'} group`}
                  onfocus={() => onGroupPreview(group.id)}
                  onblur={() => onGroupPreview(null)}
                  onclick={() => onToggleGroup(course.offeringId, group.id, !group.hidden)}>
                  <strong>{group.name}</strong>
                </button>
              <span class="group-label-space" aria-hidden="true"></span>
              {#each group.occurrences as segment (segment.id)}
                    <button type="button" class="occurrence"
                      class:dimmed={!isVisible(segment)}
                      class:explicit={overrideFor(segment) !== null}
                      class:override-hidden={overrideFor(segment) === 'hidden'}
                      class:override-shown={overrideFor(segment) === 'visible'}
                      disabled={!mayChange(segment)}
                      aria-label={`${weekday(segment)} ${exactTime(segment)}. ${overrideDescription(segment)}. ${isVisible(segment) ? 'Visible' : 'Hidden'}. Click to ${nextDescription(segment)}.`}
                      title={mayChange(segment) ? `${weekday(segment)} ${exactTime(segment)} · ${overrideDescription(segment)} · Click to ${nextDescription(segment)}` : 'Cannot override an ambiguous occurrence'}
                      onpointerenter={() => onOccurrencePreview(segment.id)}
                      onpointerleave={() => onOccurrencePreview(null)}
                      onfocus={() => onOccurrencePreview(segment.id)}
                      onblur={() => onOccurrencePreview(null)}
                      onclick={() => onToggleOccurrence(segment, nextOverride(segment))}>
                      {weekday(segment)} {hourRange(segment)}
                    </button>
              {/each}
            </div>
          {/each}
        </section>
      {/each}
    {:else}
      <p class="help">Teaching-group data is not available for this offering yet.</p>
    {/if}
  </div>
</aside>
<style>
  .context-panel { box-sizing: border-box; min-width: 0; padding: 1rem; border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 8px; background: var(--calendar-card, #fff); color: var(--calendar-text, #1e293b); }
  .hint { margin: 0 0 .7rem; font-size: .8rem; line-height: 1.5; color: var(--calendar-muted, #64748b); }
  .help { margin: .35rem 0 .6rem; color: var(--calendar-muted, #64748b); font-size: .74rem; line-height: 1.4; }
  h4 { font-size: .85rem; margin: 1rem 0 .4rem; }
  .group-type { margin-top: .75rem; }
  h5 { margin: 0 0 .3rem; padding-bottom: .3rem; border-bottom: 1px solid var(--calendar-border, #e2e8f0); font-size: .77rem; font-weight: 700; color: var(--calendar-muted, #64748b); }
  /* The group toggle is the full-card hit target. Occurrence buttons are
     siblings painted above it; no interactive element is nested in a button. */
  .group {
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: .35rem;
    padding: .4rem .55rem;
    margin: .35rem 0;
    border: 1px solid var(--calendar-border, #e2e8f0);
    border-radius: 6px;
    background: #f8fafc;
  }
  .group:hover, .group:focus-within {
    border-color: var(--calendar-primary, #2f7fd6);
    background: #eff6ff;
  }
  .group-preview {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    align-items: flex-start;
    text-align: left;
    width: 100%;
    padding: .48rem .65rem;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: var(--calendar-text, #1e293b);
    font-size: .8rem;
  }
  .group-preview.group-hidden { opacity: .55; }
  .group-preview.group-hidden strong { text-decoration: line-through; }
  .group-preview.group-hidden:hover, .group-preview.group-hidden:focus-visible { opacity: .85; }
  .group-preview:focus-visible { outline-offset: -2px; }
  /* Flexible spacer keeps the group label clear and pushes all chips right. */
  .group-label-space { flex: 1 0 5.5rem; height: 1.25rem; pointer-events: none; }
  strong { font-size: .83rem; }
  button {
    border: 1px solid var(--calendar-border, #e2e8f0);
    border-radius: 6px;
    background: var(--calendar-card, white);
    color: var(--calendar-primary, #2f7fd6);
    padding: .38rem .5rem;
    font: inherit;
    font-size: .73rem;
    cursor: pointer;
  }
  button:disabled { opacity: .5; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .occurrence {
    position: relative;
    z-index: 1;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding: .2rem .4rem;
    font-size: .7rem;
    white-space: nowrap;
    color: var(--calendar-text, #1e293b);
  }
  .occurrence.dimmed { opacity: .55; background: #f1f5f9; }
  .occurrence.override-hidden { text-decoration: line-through; text-decoration-thickness: 1px; }
  .occurrence.override-shown { background: #e8f2fd; border-color: var(--calendar-primary, #2f7fd6); font-weight: 700; }
  .occurrence.explicit:not(.override-hidden):not(.override-shown) { border-style: dashed; }
  .occurrence:hover:not(:disabled) { background: #eff6ff; border-color: var(--calendar-primary, #2f7fd6); }
</style>
