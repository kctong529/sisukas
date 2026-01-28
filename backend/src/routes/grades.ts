// src/routes/grades.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { CourseGradesService } from "../services/CourseGradesService";

const router = Router();

// Apply requireAuth to all routes in this router
router.use(requireAuth);

/**
 * GET /api/grades
 * Get all course grades for the current user
 *
 * Protected: Requires authentication
 * Response: { grades: CourseGrade[], count: number }
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const grades = await CourseGradesService.getGradesByUser(userId);

    res.json({
      grades,
      count: grades.length,
    });
  } catch (error) {
    console.error("Get grades error:", error);
    res.status(500).json({
      error: "Failed to get grades",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/grades/:courseUnitId
 * Get a single grade by courseUnitId for the current user
 *
 * Protected: Requires authentication
 * Response: { grade: CourseGrade | null }
 */
router.get("/:courseUnitId", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { courseUnitId } = req.params;

    if (!courseUnitId) {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseUnitId: "This field is required" },
      });
    }

    const grade = await CourseGradesService.getGrade(userId, courseUnitId);
    res.json({ grade });
  } catch (error) {
    console.error("Get grade error:", error);
    res.status(500).json({
      error: "Failed to get grade",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/grades/:courseUnitId
 * Upsert a grade for a course unit (create if missing, update if exists)
 *
 * Protected: Requires authentication
 * Body: { grade: number }
 * Response: { message: string, grade: CourseGrade }
 */
router.put("/:courseUnitId", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userEmail = res.locals.user.email;
    const { courseUnitId } = req.params;
    const { grade } = req.body;

    if (!courseUnitId) {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseUnitId: "This field is required" },
      });
    }

    // Validate grade
    if (grade === undefined || grade === null || typeof grade !== "number" || !Number.isInteger(grade)) {
      return res.status(400).json({
        error: "Validation failed",
        details: { grade: "Grade is required and must be an integer" },
      });
    }

    if (grade < 0 || grade > 5) {
      return res.status(400).json({
        error: "Validation failed",
        details: { grade: "Grade must be between 0 and 5" },
      });
    }

    const saved = await CourseGradesService.upsertGrade({
      userId,
      courseUnitId,
      grade,
    });

    res.json({
      message: "Grade saved successfully",
      grade: saved,
      savedBy: userEmail,
    });
  } catch (error) {
    console.error("Upsert grade error:", error);
    res.status(500).json({
      error: "Failed to save grade",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/grades/:courseUnitId
 * Remove a grade for the current user
 *
 * Protected: Requires authentication
 * Ownership: User can only delete their own grade
 * Response: { message: string, courseUnitId: string }
 */
router.delete("/:courseUnitId", async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userEmail = res.locals.user.email;
    const { courseUnitId } = req.params;

    if (!courseUnitId) {
      return res.status(400).json({
        error: "Validation failed",
        details: { courseUnitId: "This field is required" },
      });
    }

    const exists = await CourseGradesService.exists(userId, courseUnitId);
    if (!exists) {
      return res.status(404).json({
        error: "Grade not found",
        message: "Either this grade does not exist or you do not have permission to delete it",
      });
    }

    await CourseGradesService.removeGrade(userId, courseUnitId);

    res.json({
      message: "Grade removed successfully",
      courseUnitId,
      removedBy: userEmail,
    });
  } catch (error) {
    console.error("Delete grade error:", error);
    res.status(500).json({
      error: "Failed to delete grade",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
