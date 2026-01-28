// src/infrastructure/services/GradesService.ts
import { NotificationService } from "./NotificationService";

export interface CourseGrade {
  userId: string;
  courseUnitId: string;
  grade: number;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export class GradesService {
  private baseUrl = `${API_BASE}/api/grades`;

  /**
   * Get all grades for current user
   * Requires authentication
   */
  async loadAll(): Promise<CourseGrade[]> {
    const response = await fetch(this.baseUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      throw new Error(`Failed to load grades: ${response.statusText}`);
    }

    const data = await response.json();
    return data.grades || [];
  }

  /**
   * Upsert (create/update) a grade
   * PUT /api/grades/:courseUnitId
   */
  async upsert(courseUnitId: string, grade: number): Promise<CourseGrade> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(courseUnitId)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      if (response.status === 400) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Invalid grade");
      }
      throw new Error(`Failed to save grade: ${response.statusText}`);
    }

    const data = await response.json();
    NotificationService.success("Grade saved");
    return data.grade;
  }

  /**
   * Delete a grade
   * DELETE /api/grades/:courseUnitId
   */
  async remove(courseUnitId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(courseUnitId)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      if (response.status === 404) throw new Error("Grade not found");
      throw new Error(`Failed to remove grade: ${response.statusText}`);
    }

    NotificationService.success("Grade removed");
  }
}

export const gradesService = new GradesService();
