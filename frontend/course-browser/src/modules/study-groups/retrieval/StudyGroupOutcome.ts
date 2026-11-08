import type { StudyGroup } from "../models/StudyGroup";

export type StudyGroupOutcome =
  | {
      status: "success";
      groups: StudyGroup[];
    }
  | {
      status: "failure";
      error: Error;
    };
