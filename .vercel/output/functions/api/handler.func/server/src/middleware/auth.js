import jwt from 'jsonwebtoken';
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
//# sourceMappingURL=auth.js.map