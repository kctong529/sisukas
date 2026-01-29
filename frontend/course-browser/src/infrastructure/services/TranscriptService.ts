// src/infrastructure/services/TranscriptService.ts

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export type BulkImportInput = {
  planId: string;
  favouriteCourseIds: string[];
  addInstanceIds: string[];
  removeInstanceIds: string[];
  grades: Array<{ courseUnitId: string; grade: number }>;
};

export type BulkImportResult = {
  addedFavourites: number;
  removedInstances: number;
  addedInstances: number;
  upsertedGrades: number;
};

export class TranscriptService {
  private baseUrl = `${API_BASE}/api/transcript`;

  async importBulk(input: BulkImportInput): Promise<BulkImportResult> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      // try to surface backend error message if present
      let msg = response.statusText;
      try {
        const data = await response.json();
        msg = data?.message || data?.error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(`Failed to import transcript: ${msg}`);
    }

    return response.json();
  }
}

export const transcriptService = new TranscriptService();
