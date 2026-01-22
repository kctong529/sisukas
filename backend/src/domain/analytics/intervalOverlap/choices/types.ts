import type { IntervalInput, OverlapAnalytics } from "../types";
import type { NormalizedInterval } from "../types";

export type ChoiceEntity = {
  id: string;
  options: ChoiceOption[];
};

export type ChoiceOption = {
  id: string;
  intervals: IntervalInput[]; // ISO at boundary
};

export type NormalizedChoiceEntity = {
  id: string;
  options: Array<{
    id: string;
    normalized: NormalizedInterval[]; // ms intervals
    droppedCount: number;
  }>;
};

export type CombinationSelection = {
  optionIndexByEntity: number[];
  optionIdByEntity: string[];
};

export type CombinationResult = {
  selection: CombinationSelection;
  analytics: OverlapAnalytics;
  score: number;
};
