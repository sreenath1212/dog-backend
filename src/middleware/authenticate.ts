import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        isEmailVerified: boolean;
      };
    }
  }
}

/**
 * Authentication middleware — verifies the JWT access token from the httpOnly cookie.
 * Attaches the authenticated user to req.user on success.
 * Returns 401 on failure — NEVER reveals why the token was invalid (prevents enumeration).
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.accessToken as string | undefined;

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    let payload: { sub: string; email: string; role: string; isEmailVerified: boolean };
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as typeof payload;
    } catch {
      // SECURITY: Generic message — don't reveal "token expired" vs "invalid signature"
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Verify user still exists in DB (handles deleted accounts)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isEmailVerified: true },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware that requires email to be verified.
 * Must be used AFTER authenticate middleware.
 */
export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required. Please verify your email address.',
    });
    return;
  }
  next();
}
