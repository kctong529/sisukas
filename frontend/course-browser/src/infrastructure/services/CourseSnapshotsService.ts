// src/infrastructure/services/CourseSnapshotsService.ts
import { NotificationService } from "./NotificationService";
import type { CourseSnapshot, SnapshotStatus, ResolveAndStoreResponse } from "../../domain/models/CourseSnapshot";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export class CourseSnapshotsService {
  /**
   * GET /api/course-snapshots/status?courseCode=CS-E4675
   * Cheap presence check for UI
   */
  static async getStatus(courseCode: string): Promise<SnapshotStatus> {
    const code = courseCode.trim();
    const url = `${API_BASE}/api/course-snapshots/status?courseCode=${encodeURIComponent(code)}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      throw new Error(`Failed to get snapshot status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * GET /api/course-snapshots?courseCode=CS-E4675
   * Return non-expired snapshots for a course code.
   */
  static async getSnapshots(courseCode: string): Promise<CourseSnapshot[]> {
    const code = courseCode.trim();
    const url = `${API_BASE}/api/course-snapshots?courseCode=${encodeURIComponent(code)}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      throw new Error(`Failed to fetch snapshots: ${response.statusText}`);
    }

    const data = await response.json();
    return data.snapshots || [];
  }

  /**
   * POST /api/course-snapshots/resolve
   * Resolve via sisu-wrapper and upsert snapshots.
   */
  static async resolveAndStore(courseCode: string): Promise<ResolveAndStoreResponse> {
    const response = await fetch(`${API_BASE}/api/course-snapshots/resolve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseCode: courseCode.trim() }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      const text = await response.text();
      throw new Error(text.slice(0, 500));
    }

    const data = (await response.json()) as ResolveAndStoreResponse;
    NotificationService.success(`Stored ${data.snapshots?.length ?? 0} snapshots for ${data.courseCode}`);
    return data;
  }

  /**
   * GET /api/course-snapshots/all?liveOnly=true
   * Requires a backend endpoint (recommended).
   */
  static async listAll(opts?: { liveOnly?: boolean }): Promise<CourseSnapshot[]> {
    const url = new URL(`${API_BASE}/api/course-snapshots/all`);
    if (opts?.liveOnly) url.searchParams.set("liveOnly", "true");

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Authentication required");
      throw new Error(`Failed to list snapshots: ${response.statusText}`);
    }

    const data = await response.json();
    return data.snapshots || [];
  }
}
