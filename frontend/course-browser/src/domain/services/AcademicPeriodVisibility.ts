// src/domain/services/AcademicPeriodVisibility.ts
import type { AcademicPeriod } from "../models/AcademicPeriod";

type YearRange = {
  academicYear: string;
  minStartMs: number;
  maxEndMs: number;
};

export class AcademicPeriodVisibility {
  /**
   * Keep only periods whose academicYear is current or future.
   *
   * Academic year is "current" iff today is within [earliestStart, latestEnd]
   * across all AcademicPeriod entries with the same academicYear.
   *
   * Future years are those whose earliestStart is after today.
   */
  static currentAndFuture(periods: AcademicPeriod[], now: Date = new Date()): AcademicPeriod[] {
    const nowMs = now.getTime();

    // Build academicYear -> [minStart, maxEnd]
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

    // Decide which academic years to include
    const includedYears = new Set<string>();

    for (const r of rangesByYear.values()) {
      const isCurrent = r.minStartMs <= nowMs && nowMs <= r.maxEndMs; // inclusive
      const isFuture = r.minStartMs > nowMs;
      if (isCurrent || isFuture) includedYears.add(r.academicYear);
    }

    // Filter periods to included years
    return periods.filter(p => includedYears.has(p.academicYear));
  }
}
