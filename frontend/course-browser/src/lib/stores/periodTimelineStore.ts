// src/lib/stores/periodTimelineStore.ts
import { derived } from 'svelte/store';
import { plansStore } from './plansStore';
import { academicPeriodStore } from './academicPeriodStore';
import { courseIndexStore } from './courseIndexStore';
import { PeriodTimelineService } from '../../domain/services/PeriodTimelineService';
import type { PeriodTimelineModel } from '../../domain/viewModels/PeriodTimelineModel';
import type { Course } from '../../domain/models/Course';

function defaultAcademicYear(periods: { academicYear: string }[]): string {
  return [...new Set(periods.map((p) => p.academicYear))].sort().at(-1)!;
}

function displayName(course: Course): string {
  const n = course?.name;
  if (!n) return 'Untitled';
  if (typeof n === 'string') return n;
  return n.en ?? n.fi ?? n.sv ?? 'Untitled';
}

export const periodTimelineStore = derived(
  [plansStore, academicPeriodStore, courseIndexStore],
  ([$plans, $periods, $courseIndex]): PeriodTimelineModel | null => {
    const plan = $plans.activePlan;
    if (!plan || !$periods || $periods.length === 0) return null;

    const academicYear = defaultAcademicYear($periods);

    const instances = plan.instanceIds
      .map((id) => $courseIndex.byInstanceId.get(id))
      .filter((c): c is Course => Boolean(c))
      .map((c: Course) => ({
        instanceId: c.id,
        courseCode: c.code.value,
        name: displayName(c),
        dateRange: c.courseDate,
        credits: c.credits?.min
      }));

    if (instances.length === 0) return null;

    return PeriodTimelineService.build({
      academicYear,
      periods: $periods,
      instances
    });
  }
);
