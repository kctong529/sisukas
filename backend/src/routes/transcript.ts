// backend/src/routes/transcript.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { TranscriptService } from "../services/TranscriptService";

const router = Router();
router.use(requireAuth);

/**
 * POST /api/transcript/import
 *
 * Bulk import transcript effects in ONE request:
 * - favourites: upsert by (userId, courseId)
 * - plan_instances: remove + add (planId must belong to user)
 * - course_grades: upsert by (userId, courseUnitId)
 */
router.post("/import", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;

    const {
      planId,
      favouriteCourseIds,
      addInstanceIds,
      removeInstanceIds,
      grades,
    } = req.body ?? {};

    // basic validation
    if (!planId || typeof planId !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        details: { planId: "planId is required and must be a string" },
      });
    }

    const out = await TranscriptService.importTranscriptBulk(userId, {
      planId,
      favouriteCourseIds: Array.isArray(favouriteCourseIds) ? favouriteCourseIds : [],
      addInstanceIds: Array.isArray(addInstanceIds) ? addInstanceIds : [],
      removeInstanceIds: Array.isArray(removeInstanceIds) ? removeInstanceIds : [],
      grades: Array.isArray(grades) ? grades : [],
    });

    res.json(out);
  } catch (error) {
    console.error("Transcript import error:", error);
    res.status(500).json({
      error: "Failed to import transcript",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
