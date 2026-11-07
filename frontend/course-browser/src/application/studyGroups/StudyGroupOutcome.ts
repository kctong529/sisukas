import type { StudyGroup } from "@domain/models/StudyGroup";

export type StudyGroupOutcome =
  | {
      status: "success";
      groups: StudyGroup[];
    }
  | {
      status: "failure";
      error: Error;
    };
