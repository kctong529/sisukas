// src/domain/models/StudyEvent.ts

export interface StudyEvent {
  id: string;
  start: string;
  end: string;
  startIso?: string;
  endIso?: string;
  location?: string;
}