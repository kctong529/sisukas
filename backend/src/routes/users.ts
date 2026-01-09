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
 * Body: { email, password, displayName? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // TODO: Hash password properly when we add auth
    // For now, just store it as-is (NOT SECURE - temporary!)
    const passwordHash = password;

    const user = await UsersService.createUser({
      email,
      passwordHash,
      displayName,
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error instanceof Error && error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create user' 
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