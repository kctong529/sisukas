// src/domain/models/StudyGroup.ts

import type { StudyEvent } from './StudyEvent';

export interface StudyGroup {
  groupId: string;
  name: string;
  type: string; // "Lecture", "Exercise", etc.
  studyEvents: StudyEvent[];
}