// src/middleware/auth.ts
import { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/auth';

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