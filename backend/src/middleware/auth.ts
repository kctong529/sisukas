// src/middleware/auth.ts
import { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/auth';

// In-memory store for admin sessions with expiration
const adminSessions = new Map<string, { expiresAt: number }>();

export async function extractSession(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: req.headers as any,
  });
  res.locals.session = session?.session || null;
  res.locals.user = session?.user || null;
  res.locals.isAuthenticated = !!session?.user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
  next();
}

/**
 * Middleware to check admin session token
 * Token passed via:
 * 1. Authorization header: "Bearer TOKEN"
 * 2. Cookie: admin_token=TOKEN
 * 3. Query param: ?admin_token=TOKEN
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Check cookies
  if (!token && req.cookies?.admin_token) {
    token = req.cookies.admin_token;
  }

  // Check query params (for browser links)
  if (!token && req.query.admin_token) {
    token = req.query.admin_token as string;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin session required. Visit /api/admin/login',
    });
  }

  const session = adminSessions.get(token);
  
  // Check if token exists and hasn't expired
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin session expired. Visit /api/admin/login',
    });
  }

  res.locals.adminToken = token;
  next();
}

/**
 * Helper function to generate random token
 */
export function generateAdminToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Helper function to validate admin credentials
 */
export function validateAdminCredentials(username: string, password: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return false;
  }

  return username === adminUsername && password === adminPassword;
}

/**
 * Helper function to create admin session
 */
export function createAdminSession(): string {
  const token = generateAdminToken();
  adminSessions.set(token, {
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  return token;
}

/**
 * Helper function to destroy admin session
 */
export function destroyAdminSession(token: string): void {
  adminSessions.delete(token);
}

/**
 * Helper function to check if session exists
 */
export function isAdminSessionValid(token: string): boolean {
  return adminSessions.has(token);
}