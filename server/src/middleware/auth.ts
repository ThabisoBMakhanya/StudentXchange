import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export type AppRole = 'customer' | 'seller' | 'admin';
export type AuthRequest = Request & { auth?: { userId: string; role: AppRole } };

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; role: AppRole };
    const result = await query('SELECT "status","roles" FROM users WHERE "id"=$1', [claims.userId]);
    const account = result.rows[0];
    if (!account || account.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is paused or unavailable.' });
    const roles: string[] = account.roles || [];
    const role: AppRole = roles.includes('ADMIN') ? 'admin' : roles.includes('SELLER') ? 'seller' : 'customer';
    req.auth = { userId: claims.userId, role };
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    }
    console.error('Authentication account check failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'Could not verify your account. Try again shortly.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  return next();
}

export async function requireApprovedKyc(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.auth?.role === 'admin') return next();
  try {
    const result = await query('SELECT "kycStatus","status" FROM users WHERE "id"=$1', [req.auth?.userId]);
    const user = result.rows[0];
    if (!user || user.status !== 'ACTIVE') return res.status(403).json({ error: 'An active account is required.' });
    if (user.kycStatus !== 'APPROVED') return res.status(403).json({ error: 'Submit your student verification and wait for admin approval before using marketplace features.', kyc_status: String(user.kycStatus).toLowerCase() });
    return next();
  } catch (error) {
    console.error('KYC access check failed:', error);
    return res.status(500).json({ error: 'Could not check student verification status.' });
  }
}
