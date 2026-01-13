// src/routes/favourites.ts
import { Router, Request, Response } from 'express';
import { FavouritesService } from '../services/FavouritesService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all routes in this router
router.use(requireAuth);

/**
 * GET /api/favourites
 * Get all favourites for the current user
 * 
 * Protected: Requires authentication
 * Response: { favourites: Favourite[] }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userFavourites = await FavouritesService.getFavouritesByUser(userId);

    res.json({ 
      favourites: userFavourites,
      count: userFavourites.length,
    });
  } catch (error) {
    console.error('Get favourites error:', error);
    res.status(500).json({
      error: 'Failed to get favourites',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/favourites
 * Add a new favourite for the current user
 * 
 * Protected: Requires authentication
 * Body: { courseId: string, notes?: string }
 * Response: { message: string, favourite: Favourite }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userEmail = res.locals.user.email;
    const { courseId, notes } = req.body;

    // Validate required field
    if (!courseId) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { courseId: 'This field is required' },
      });
    }

    const favourite = await FavouritesService.addFavourite({
      userId,
      courseId,
      notes: notes || null,
    });

    res.status(201).json({
      message: 'Favourite added successfully',
      favourite,
      addedBy: userEmail,
    });
  } catch (error) {
    console.error('Add favourite error:', error);
    res.status(500).json({
      error: 'Failed to add favourite',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/favourites/:courseId
 * Remove a favourite for the current user
 * 
 * Protected: Requires authentication
 * Ownership: User can only delete their own favourites
 * Response: { message: string, courseId: string }
 */
router.delete('/:courseId', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userEmail = res.locals.user.email;
    const { courseId } = req.params;

    // Verify ownership before deleting
    const exists = await FavouritesService.verifyOwnership(userId, courseId);
    if (!exists) {
      return res.status(404).json({
        error: 'Favourite not found',
        message: 'Either this favourite does not exist or you do not have permission to delete it',
      });
    }

    await FavouritesService.removeFavourite(userId, courseId);

    res.json({
      message: 'Favourite removed successfully',
      courseId,
      removedBy: userEmail,
    });
  } catch (error) {
    console.error('Delete favourite error:', error);
    res.status(500).json({
      error: 'Failed to delete favourite',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/favourites/:courseId
 * Update notes for a favourite
 * 
 * Protected: Requires authentication
 * Ownership: User can only update their own favourites
 * Body: { notes: string | null }
 * Response: { message: string, favourite: Favourite }
 */
router.patch('/:courseId', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { courseId } = req.params;
    const { notes } = req.body;

    // Validate required field
    if (notes === undefined) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { notes: 'This field is required' },
      });
    }

    // Verify ownership before updating
    const exists = await FavouritesService.verifyOwnership(userId, courseId);
    if (!exists) {
      return res.status(404).json({
        error: 'Favourite not found',
        message: 'Either this favourite does not exist or you do not have permission to update it',
      });
    }

    const updated = await FavouritesService.updateFavouriteNotes(
      userId,
      courseId,
      notes
    );

    res.json({
      message: 'Favourite updated successfully',
      favourite: updated,
    });
  } catch (error) {
    console.error('Update favourite error:', error);
    res.status(500).json({
      error: 'Failed to update favourite',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;