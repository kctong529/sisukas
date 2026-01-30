// src/lib/stores/periodTimelineStore.svelte.ts
import { plansStore } from "./plansStore.svelte";
import { academicPeriodStore } from "./academicPeriodStore";
import { courseIndexStore } from "./courseIndexStore.svelte";
import { periodTimelineYearStore } from "./periodTimelineYearStore";
import { courseGradeStore } from "./courseGradeStore";
import { PeriodTimelineService } from "../../domain/services/PeriodTimelineService";
import type { Course } from "../../domain/models/Course";
import type { AcademicPeriod } from "../../domain/models/AcademicPeriod";

interface GradesData {
  grades?: Map<string, number>;
}

function defaultAcademicYear(periods: AcademicPeriod[]): string {
  return [...new Set(periods.map((p) => p.academicYear))].sort().at(-1)!;
}

function displayName(course: Course): string {
  const n = course?.name;
  if (!n) return "Untitled";
  if (typeof n === "string") return n;
  return n.en ?? n.fi ?? n.sv ?? "Untitled";
}

// Module-level state
const state = $state({
  periods: [] as AcademicPeriod[],
  selectedYear: null as string | null,
  gradesData: {} as GradesData,
});

// Subscribe to traditional stores
let unsubPeriods: (() => void) | null = null;
let unsubYear: (() => void) | null = null;
let unsubGrades: (() => void) | null = null;

function initSubscriptions() {
  if (!unsubPeriods) {
    unsubPeriods = academicPeriodStore.subscribe((p) => {
      state.periods = p ?? [];
    });
  }
  if (!unsubYear) {
    unsubYear = periodTimelineYearStore.subscribe((y) => {
      state.selectedYear = y;
    });
  }
  if (!unsubGrades) {
    unsubGrades = courseGradeStore.subscribe((g) => {
      state.gradesData = g ?? {};
    });
  }
}

// Initialize on first import
initSubscriptions();

const timeline = $derived.by(() => {
  const activePlan = plansStore.read.getActive();
  
  if (!activePlan || !state.periods || state.periods.length === 0) {
    return null;
  }

  const availableYears = [...new Set(state.periods.map((p) => p.academicYear))].sort();
  const fallbackYear = defaultAcademicYear(state.periods);
  const academicYear =
    state.selectedYear && availableYears.includes(state.selectedYear) 
      ? state.selectedYear 
      : fallbackYear;

  const instances = activePlan.instanceIds
    .map((id) => courseIndexStore.read.resolveByInstanceId(id))
    .filter((c): c is Course => Boolean(c))
    .map((c) => ({
      instanceId: c.id,
      unitId: c.unitId,
      courseCode: c.code.value,
      name: displayName(c),
      dateRange: c.courseDate,
      credits: c.credits?.min ?? 0,
    }));

  if (instances.length === 0) {
    return null;
  }

  return PeriodTimelineService.build({
    academicYear,
    periods: state.periods,
    instances,
    getGradeByUnitId: (unitId) => state.gradesData.grades?.get(unitId),
  });
});

export const periodTimelineStore = {
  state,
  get timeline() {
    return timeline;
  },
};
