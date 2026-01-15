// src/domain/models/StudyEvent.ts

export interface StudyEvent {
  start: string; // ISO 8601 datetime
  end: string;   // ISO 8601 datetime
  location?: string;
}