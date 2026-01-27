// src/domain/services/AcademicPeriodVisibility.ts
import type { AcademicPeriod } from "../models/AcademicPeriod";

type YearRange = {
  academicYear: string;
  minStartMs: number;
  maxEndMs: number;
};

function buildYearRanges(periods: AcademicPeriod[]): Map<string, YearRange> {
  const rangesByYear = new Map<string, YearRange>();

  for (const p of periods) {
    const startMs = p.dateRange.start.getTime();
    const endMs = p.dateRange.end.getTime();

    const existing = rangesByYear.get(p.academicYear);
    if (!existing) {
      rangesByYear.set(p.academicYear, {
        academicYear: p.academicYear,
        minStartMs: startMs,
        maxEndMs: endMs,
      });
    } else {
      existing.minStartMs = Math.min(existing.minStartMs, startMs);
      existing.maxEndMs = Math.max(existing.maxEndMs, endMs);
    }
  }

  return rangesByYear;
}

export class AcademicPeriodVisibility {
  static currentAcademicYear(periods: AcademicPeriod[], now: Date = new Date()): string | null {
    const nowMs = now.getTime();
    const rangesByYear = buildYearRanges(periods);

    const currentYears = Array.from(rangesByYear.values())
      .filter(r => r.minStartMs <= nowMs && nowMs <= r.maxEndMs);

    if (currentYears.length === 0) return null;

    // Deterministic pick: most recent-starting current year
    currentYears.sort((a, b) => a.minStartMs - b.minStartMs);
    return currentYears.at(-1)!.academicYear;
  }

  static currentAndFuture(periods: AcademicPeriod[], now: Date = new Date()): AcademicPeriod[] {
    const nowMs = now.getTime();
    const rangesByYear = buildYearRanges(periods);

    const includedYears = new Set<string>();
    for (const r of rangesByYear.values()) {
      const isCurrent = r.minStartMs <= nowMs && nowMs <= r.maxEndMs;
      const isFuture = r.minStartMs > nowMs;
      if (isCurrent || isFuture) includedYears.add(r.academicYear);
    }

    return periods.filter(p => includedYears.has(p.academicYear));
  }
}
