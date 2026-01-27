// src/lib/stores/periodTimelineStore.ts
import { derived } from 'svelte/store';
import { plansStore } from './plansStore';
import { academicPeriodStore } from './academicPeriodStore';
import { courseIndexStore } from './courseIndexStore';
import { periodTimelineYearStore } from './periodTimelineYearStore';
import { courseGradeStore } from './courseGradeStore';
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
  [
    plansStore,
    academicPeriodStore,
    courseIndexStore,
    periodTimelineYearStore,
    courseGradeStore,
  ],
  ([$plans, $periods, $courseIndex, $selectedYear, $grades]): PeriodTimelineModel | null => {
    const plan = $plans.activePlan;
    if (!plan || !$periods || $periods.length === 0) return null;

    const availableYears = [...new Set($periods.map(p => p.academicYear))].sort();
    const fallbackYear = defaultAcademicYear($periods);
    const academicYear =
      $selectedYear && availableYears.includes($selectedYear) ? $selectedYear : fallbackYear;

    const instances = plan.instanceIds
      .map((id) =>
        $courseIndex.byInstanceId.get(id) ??
        $courseIndex.historicalByInstanceId?.get(id)
      )
      .filter((c): c is Course => Boolean(c))
      .map((c: Course) => ({
        instanceId: c.id,
        unitId: c.unitId,
        courseCode: c.code.value,
        name: displayName(c),
        dateRange: c.courseDate,
        credits: c.credits?.min ?? 0,
      }));

    if (instances.length === 0) return null;

    return PeriodTimelineService.build({
      academicYear,
      periods: $periods,
      instances,
      getGradeByUnitId: (unitId) => $grades.get(unitId),
    });
  }
);
