// src/routes/users.ts
import { Router, Request, Response } from 'express';
import { UsersService } from '../services/UsersService';

const router = Router();

/**
 * GET /api/users
 * Get all users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const allUsers = await UsersService.getAllUsers();
    res.json({ users: allUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get users' 
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await UsersService.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get user' 
    });
  }
});

/**
 * POST /api/users
 * Create a new user
 * Body: { email, password, name? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const result = await UsersService.createUser({ email, password, name });
    return res.status(201).json(result);
  } catch (error: any) {console.error("Create User Error:", error);

    let statusCode = 500;
    if (typeof error.status === 'number') {
      statusCode = error.status;
    } else if (error.status === "UNPROCESSABLE_ENTITY" || error.code === "VALIDATION_ERROR") {
      statusCode = 422;
    } else if (error.status === "BAD_REQUEST") {
      statusCode = 400;
    } else if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      statusCode = 409;
    }

    return res.status(statusCode).json({
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred"
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await UsersService.deleteUser(id);

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted', user: deleted });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete user' 
    });
  }
});

export default router;