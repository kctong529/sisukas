// src/routes/plans.ts
import { Router, Request, Response } from 'express';
import { PlansService } from '../services/PlansService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all routes in this router
router.use(requireAuth);

/**
 * GET /api/plans
 * Get all plans for the current user
 * 
 * Protected: Requires authentication
 * Response: { Plan[] }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const userPlans = await PlansService.getPlansByUser(userId);

    res.json(userPlans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      error: 'Failed to get plans',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/plans
 * Create a new plan for the current user
 * 
 * Protected: Requires authentication
 * Body: { name: string }
 * Response: { id: string, userId: string, name: string, isActive: boolean, instanceIds: string[], createdAt: Date, updatedAt: Date }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { name } = req.body;

    // Validate required field
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        details: { name: 'Name is required and must be a string' },
      });
    }

    const plan = await PlansService.createPlan({
      userId,
      name: name.trim(),
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      error: 'Failed to create plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/plans/:planId/activate
 * Set a plan as active (deactivates all other plans for this user)
 * 
 * Protected: Requires authentication
 * Ownership: User can only activate their own plans
 * Response: { id: string, userId: string, name: string, isActive: boolean, instanceIds: string[], createdAt: Date, updatedAt: Date }
 */
router.patch('/:planId/activate', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { planId } = req.params;

    // Verify ownership before activating
    const exists = await PlansService.verifyOwnership(userId, planId);
    if (!exists) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'Either this plan does not exist or you do not have permission to activate it',
      });
    }

    const plan = await PlansService.setActivePlan(userId, planId);

    res.json(plan);
  } catch (error) {
    console.error('Activate plan error:', error);
    res.status(500).json({
      error: 'Failed to activate plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/plans/:planId/instances
 * Add an instance to a plan
 * 
 * Protected: Requires authentication
 * Ownership: User can only add instances to their own plans
 * Body: { instanceId: string }
 * Response: { id: string, userId: string, name: string, isActive: boolean, instanceIds: string[], createdAt: Date, updatedAt: Date }
 */
router.post('/:planId/instances', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { planId } = req.params;
    const { instanceId } = req.body;

    // Validate required field
    if (!instanceId || typeof instanceId !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        details: { instanceId: 'Instance ID is required and must be a string' },
      });
    }

    // Verify ownership before adding instance
    const exists = await PlansService.verifyOwnership(userId, planId);
    if (!exists) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'Either this plan does not exist or you do not have permission to modify it',
      });
    }

    const plan = await PlansService.addInstance(userId, planId, instanceId);

    res.json(plan);
  } catch (error) {
    console.error('Add instance error:', error);
    res.status(500).json({
      error: 'Failed to add instance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/plans/:planId/instances/:instanceId
 * Remove an instance from a plan
 * 
 * Protected: Requires authentication
 * Ownership: User can only remove instances from their own plans
 * Response: { id: string, userId: string, name: string, isActive: boolean, instanceIds: string[], createdAt: Date, updatedAt: Date }
 */
router.delete('/:planId/instances/:instanceId', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { planId, instanceId } = req.params;

    // Verify ownership before removing instance
    const exists = await PlansService.verifyOwnership(userId, planId);
    if (!exists) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'Either this plan does not exist or you do not have permission to modify it',
      });
    }

    const plan = await PlansService.removeInstance(userId, planId, instanceId);

    res.json(plan);
  } catch (error) {
    console.error('Remove instance error:', error);
    res.status(500).json({
      error: 'Failed to remove instance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/plans/:planId
 * Update a plan (name)
 * 
 * Protected: Requires authentication
 * Ownership: User can only update their own plans
 * Body: { name: string }
 * Response: { id: string, userId: string, name: string, isActive: boolean, instanceIds: string[], createdAt: Date, updatedAt: Date }
 */
router.patch('/:planId', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { planId } = req.params;
    const { name } = req.body;

    // Validate required field
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        details: { name: 'Name is required and must be a string' },
      });
    }

    // Verify ownership before updating
    const exists = await PlansService.verifyOwnership(userId, planId);
    if (!exists) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'Either this plan does not exist or you do not have permission to modify it',
      });
    }

    const plan = await PlansService.updatePlanName(planId, name.trim());

    res.json(plan);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({
      error: 'Failed to update plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/plans/:planId
 * Delete a plan
 * 
 * Protected: Requires authentication
 * Ownership: User can only delete their own plans
 * Response: 204 No Content
 */
router.delete('/:planId', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user.id;
    const { planId } = req.params;

    // Verify ownership before deleting
    const exists = await PlansService.verifyOwnership(userId, planId);
    if (!exists) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'Either this plan does not exist or you do not have permission to delete it',
      });
    }

    await PlansService.deletePlan(planId);

    res.status(204).send();
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      error: 'Failed to delete plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
