// src/domain/services/PeriodTimelineService.ts
import type { AcademicPeriod } from "../models/AcademicPeriod";
import type { DateRange } from "../valueObjects/DateRange";
import type { PeriodTimelineChip, PeriodTimelineModel } from "../viewModels/PeriodTimelineModel";

const PERIOD_ORDER = ["I", "II", "III", "IV", "V"];

function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

function sortPeriods(ps: AcademicPeriod[]): AcademicPeriod[] {
  const idx = (p: AcademicPeriod) => PERIOD_ORDER.indexOf(p.name);
  return [...ps].sort((a, b) => idx(a) - idx(b));
}

function spanLabel(touched: AcademicPeriod[]): string {
  if (touched.length === 0) return "?";
  if (touched.length === 1) return touched[0].name;
  return `${touched[0].name}–${touched[touched.length - 1].name}`;
}

export class PeriodTimelineService {
  static build(params: {
    academicYear: string;
    periods: AcademicPeriod[];
    instances: Array<{
      instanceId: string;
      unitId: string;
      courseCode: string;
      name: string;
      dateRange: DateRange;
      credits: number;
    }>;
    getGradeByUnitId?: (unitId: string) => number | undefined;
  }): PeriodTimelineModel {
    const { academicYear, periods, instances, getGradeByUnitId } = params;

    const yearPeriods = sortPeriods(
      periods.filter(
        (p) => p.academicYear === academicYear && PERIOD_ORDER.includes(p.name)
      )
    );

    const columns: PeriodTimelineModel["columns"] = yearPeriods.map((p) => ({
      period: p,
      items: [],
    }));

    // periodId -> column index
    const colIndexByPeriodId = new Map<string, number>();
    columns.forEach((c, idx) => colIndexByPeriodId.set(c.period.id, idx));

    const creditsPerPeriod = new Array<number>(columns.length).fill(0);
    const singlePeriodCreditsPerPeriod = new Array<number>(columns.length).fill(0);

    const colByPeriodId = new Map<string, (typeof columns)[number]>();
    columns.forEach((c) => colByPeriodId.set(c.period.id, c));

    for (const inst of instances) {
      const touched = yearPeriods.filter((p) => overlaps(inst.dateRange, p.dateRange));
      if (touched.length === 0) continue;

      // Credit aggregation
      const spanCount = touched.length;
      const share = inst.credits / spanCount;

      for (const p of touched) {
        const colIdx = colIndexByPeriodId.get(p.id);
        if (colIdx === undefined) continue;

        creditsPerPeriod[colIdx] += share;
        if (spanCount === 1) {
          singlePeriodCreditsPerPeriod[colIdx] += inst.credits;
        }
      }

      const chip: PeriodTimelineChip = {
        key: inst.instanceId,
        instanceId: inst.instanceId,
        unitId: inst.unitId,
        grade: getGradeByUnitId?.(inst.unitId),
        courseCode: inst.courseCode,
        name: inst.name,
        credits: inst.credits,
        spanLabel: spanLabel(touched),
      };

      for (const p of touched) {
        colByPeriodId.get(p.id)?.items.push(chip);
      }
    }

    for (const col of columns) {
      col.items.sort(
        (a, b) => a.courseCode.localeCompare(b.courseCode) || a.name.localeCompare(b.name)
      );
    }

    return {
      academicYear,
      columns,
      creditsPerPeriod,
      singlePeriodCreditsPerPeriod,
    } as PeriodTimelineModel;
  }
}
