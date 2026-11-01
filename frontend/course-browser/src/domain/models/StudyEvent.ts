// src/domain/models/StudyEvent.ts

export interface StudyLocation {
  id: string;
  name: string;
  buildingId?: string | null;
  buildingName?: string | null;
  address?: string | null;
}

export interface StudyEvent {
  // Legacy frontend identifier; not a SISU occurrence ID.
  id: string;

  start: string;
  end: string;
  startIso?: string;
  endIso?: string;

  // Source metadata
  seriesId?: string | null;
  cancelled: boolean;
  excluded: boolean;
  notice?: string | null;
  locationIds: string[];
  locations: StudyLocation[];

  // Legacy display-friendly representation
  location?: string;
}
