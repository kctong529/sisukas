// src/routes/courseSnapshots.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { CourseSnapshotsService } from "../services/CourseSnapshotsService";

const router = Router();
router.use(requireAuth);

function readCourseCode(req: Request): string | null {
  const courseCode = String(req.query.courseCode ?? "").trim();
  return courseCode ? courseCode : null;
}


/**
 * GET /api/course-snapshots/status?courseCode=CS-E4675
 * Cheap presence check for UI:
 * - hasAny: any snapshot row exists (expired or not)
 * - hasLive: at least one non-expired snapshot exists
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const courseCode = readCourseCode(req);
    if (!courseCode) {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseCode: "courseCode query param is required" },
      });
    }

    const status = await CourseSnapshotsService.getSnapshotStatusByCourseCode(courseCode);
    res.json(status);
  } catch (error) {
    console.error("Get snapshot status error:", error);
    res.status(500).json({
      error: "Failed to get snapshot status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/course-snapshots?courseCode=CS-E4675
 * Return non-expired snapshots (payloads) for a course code.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const courseCode = readCourseCode(req);
    if (!courseCode) {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseCode: "courseCode query param is required" },
      });
    }

    const snapshots = await CourseSnapshotsService.getSnapshotsByCourseCode(courseCode);
    res.json({ courseCode: courseCode.toUpperCase(), snapshots });
  } catch (error) {
    console.error("Get course snapshots error:", error);
    res.status(500).json({
      error: "Failed to get course snapshots",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/course-snapshots/resolve
 * Resolve via sisu-wrapper and upsert snapshots, then return snapshots.
 *
 * Body: { courseCode: string }
 */
router.post("/resolve", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { courseCode } = req.body ?? {};

    if (!courseCode || typeof courseCode !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseCode: "courseCode is required and must be a string" },
      });
    }

    const baseUrl = process.env.SISU_WRAPPER_BASE_URL ?? "http://127.0.0.1:8001";
    const url = new URL("/api/courses/resolve", baseUrl);
    url.searchParams.set("course_code", courseCode.trim());
    url.searchParams.set("from_date", "2022-09-01");
    url.searchParams.set("to_date", "2025-12-31");
    url.searchParams.set("limit_realisations", "200");

    const resp = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({
        error: "Upstream resolve failed",
        status: resp.status,
        message: text.slice(0, 500),
      });
    }

    const resolve = await resp.json();

    const snapshots = await CourseSnapshotsService.upsertFromResolveResponse(userId, resolve, {
      source: "user_request",
      ttlDays: 180,
    });

    res.status(201).json({
      courseCode: courseCode.trim().toUpperCase(),
      snapshots,
    });
  } catch (error) {
    console.error("Resolve+store snapshots error:", error);
    res.status(500).json({
      error: "Failed to resolve and store snapshots",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
