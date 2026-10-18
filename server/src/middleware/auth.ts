import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type AppRole = 'customer' | 'seller' | 'admin';
export type AuthRequest = Request & { auth?: { userId: string; role: AppRole } };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; role: AppRole };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  return next();
}
