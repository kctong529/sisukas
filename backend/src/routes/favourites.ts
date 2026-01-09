// src/routes/favourites.ts
import { Router, Request, Response } from 'express';
import { FavouritesService } from '../services/FavouritesService';

const router = Router();

/**
 * GET /api/favourites/:userId
 * Get all favourites for a user
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userFavourites = await FavouritesService.getFavouritesByUser(userId);
    
    res.json({ favourites: userFavourites });
  } catch (error) {
    console.error('Get favourites error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get favourites' 
    });
  }
});

/**
 * POST /api/favourites
 * Add a favourite
 * Body: { userId, courseId, notes? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, courseId, notes } = req.body;

    // Basic validation
    if (!userId || !courseId) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, courseId' 
      });
    }

    const favourite = await FavouritesService.addFavourite({
      userId,
      courseId,
      notes,
    });

    res.status(201).json({ favourite });
  } catch (error) {
    console.error('Add favourite error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to add favourite' 
    });
  }
});

/**
 * DELETE /api/favourites/:userId/:courseId
 * Remove a favourite
 */
router.delete('/:userId/:courseId', async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.params;

    const deleted = await FavouritesService.removeFavourite(userId, courseId);

    if (!deleted) {
      return res.status(404).json({ error: 'Favourite not found' });
    }

    res.json({ message: 'Favourite removed', favourite: deleted });
  } catch (error) {
    console.error('Remove favourite error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to remove favourite' 
    });
  }
});

/**
 * PATCH /api/favourites/:userId/:courseId
 * Update favourite notes
 * Body: { notes }
 */
router.patch('/:userId/:courseId', async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({ error: 'Missing notes field' });
    }

    const updated = await FavouritesService.updateFavouriteNotes(
      userId,
      courseId,
      notes
    );

    if (!updated) {
      return res.status(404).json({ error: 'Favourite not found' });
    }

    res.json({ favourite: updated });
  } catch (error) {
    console.error('Update favourite error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update favourite' 
    });
  }
});

/**
 * GET /api/favourites/:userId/:courseId/check
 * Check if a course is favourited
 */
router.get('/:userId/:courseId/check', async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.params;

    const isFavourite = await FavouritesService.isFavourite(userId, courseId);

    res.json({ isFavourite });
  } catch (error) {
    console.error('Check favourite error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to check favourite' 
    });
  }
});

export default router;