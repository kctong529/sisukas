// src/infrastructure/services/CourseSnapshotsService.ts
import { NotificationService } from "./NotificationService";
import type {
  CourseSnapshot,
  SnapshotStatus,
  ResolveAndStoreResponse,
} from "../../domain/models/CourseSnapshot";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

async function readErrorMessage(res: Response): Promise<string> {
  // Try to surface backend text/json error without exploding
  const ct = res.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const json = await res.json();
      if (typeof json?.message === "string") return json.message;
      if (typeof json?.error === "string") return json.error;
      return JSON.stringify(json).slice(0, 500);
    }
    const text = await res.text();
    return text.slice(0, 500) || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function assertOk(res: Response, prefix: string): Promise<void> {
  if (res.ok) return;
  const msg = await readErrorMessage(res);
  throw new Error(`${prefix}: ${msg}`);
}

export class CourseSnapshotsService {
  /**
   * GET /api/course-snapshots/status?courseCode=CS-E4675
   * Cheap presence check for UI
   */
  static async getStatus(courseCode: string): Promise<SnapshotStatus> {
    const code = courseCode.trim();
    const url = `${API_BASE}/api/course-snapshots/status?courseCode=${encodeURIComponent(code)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // ✅ no credentials for public endpoint
    });

    await assertOk(res, "Failed to get snapshot status");
    return res.json();
  }

  /**
   * GET /api/course-snapshots?courseCode=CS-E4675
   * Return non-expired snapshots for a course code.
   */
  static async getSnapshots(courseCode: string): Promise<CourseSnapshot[]> {
    const code = courseCode.trim();
    const url = `${API_BASE}/api/course-snapshots?courseCode=${encodeURIComponent(code)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    await assertOk(res, "Failed to fetch snapshots");
    const data: { snapshots?: CourseSnapshot[] } = await res.json();
    return data.snapshots ?? [];
  }

  /**
   * POST /api/course-snapshots/resolve
   * Resolve via sisu-wrapper and upsert snapshots.
   */
  static async resolveAndStore(courseCode: string): Promise<ResolveAndStoreResponse> {
    const res = await fetch(`${API_BASE}/api/course-snapshots/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseCode: courseCode.trim() }),
    });

    await assertOk(res, "Failed to resolve and store snapshots");

    const data = (await res.json()) as ResolveAndStoreResponse;
    NotificationService.success(
      `Stored ${data.snapshots?.length ?? 0} snapshots for ${data.courseCode}`
    );
    return data;
  }

  /**
   * GET /api/course-snapshots/all?liveOnly=1
   */
  static async listAll(opts?: { liveOnly?: boolean }): Promise<CourseSnapshot[]> {
    const url = new URL(`${API_BASE}/api/course-snapshots/all`);
    if (opts?.liveOnly) url.searchParams.set("liveOnly", "1");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    await assertOk(res, "Failed to list snapshots");

    const data: { snapshots?: CourseSnapshot[] } = await res.json();
    return data.snapshots ?? [];
  }
}
