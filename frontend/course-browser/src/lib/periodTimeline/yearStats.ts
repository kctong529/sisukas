import type { PeriodTimelineChip } from "../../domain/viewModels/PeriodTimelineModel";

export type YearStats = {
  totalCreditsAll: number;        // all chips (even ungraded)
  totalCreditsGraded: number;     // only chips that contributed to avg
  weightedAverage: number | null; // weighted by credits, null if no graded credits
};

function isValidGrade(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function computeYearStats(chips: PeriodTimelineChip[]): YearStats {
  let totalCreditsAll = 0;
  let totalCreditsGraded = 0;
  let weightedSum = 0;

  for (const chip of chips) {
    const cr = Number(chip.credits ?? 0);
    if (!Number.isFinite(cr) || cr <= 0) continue;

    totalCreditsAll += cr;

    if (isValidGrade(chip.grade)) {
      totalCreditsGraded += cr;
      weightedSum += chip.grade * cr;
    }
  }

  return {
    totalCreditsAll,
    totalCreditsGraded,
    weightedAverage: totalCreditsGraded > 0 ? weightedSum / totalCreditsGraded : null,
  };
}

export function formatAvg(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
