import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
export function requireAuth(req, res, next) {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token || !process.env.JWT_SECRET)
        return res.status(401).json({ error: 'Sign in to continue.' });
    try {
        req.auth = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    }
    catch {
        return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    }
}
export function requireAdmin(req, res, next) {
    if (req.auth?.role !== 'admin')
        return res.status(403).json({ error: 'Administrator access required.' });
    return next();
}
export async function requireApprovedKyc(req, res, next) {
    if (req.auth?.role === 'admin')
        return next();
    try {
        const result = await query('SELECT "kycStatus","status" FROM users WHERE "id"=$1', [req.auth?.userId]);
        const user = result.rows[0];
        if (!user || user.status !== 'ACTIVE')
            return res.status(403).json({ error: 'An active account is required.' });
        if (user.kycStatus !== 'APPROVED')
            return res.status(403).json({ error: 'Submit your student verification and wait for admin approval before using marketplace features.', kyc_status: String(user.kycStatus).toLowerCase() });
        return next();
    }
    catch (error) {
        console.error('KYC access check failed:', error);
        return res.status(500).json({ error: 'Could not check student verification status.' });
    }
}
//# sourceMappingURL=auth.js.map