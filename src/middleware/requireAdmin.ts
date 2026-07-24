import { Request, Response, NextFunction } from 'express';

/**
 * Authorization middleware — requires the authenticated user to have the ADMIN role.
 * Must be used AFTER the authenticate middleware.
 *
 * SECURITY: This checks the role from the database-verified JWT payload on every request,
 * not just at login time. A user whose role is downgraded is immediately blocked.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    // Return 403 Forbidden — the user is authenticated but not authorized
    // Return the same message regardless of whether they're logged in, to avoid info leak
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }
  next();
}
