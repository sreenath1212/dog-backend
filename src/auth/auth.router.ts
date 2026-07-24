import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import {
  RegisterSchema,
  LoginSchema,
  ResendVerificationSchema,
} from './auth.validators';
import * as authController from './auth.controller';

export const authRouter: Router = Router();

/**
 * POST /api/auth/register
 * Register a new user account.
 * Rate limited: 5 req/15min per IP
 * Public route — no auth required.
 * Body: { name, email, password }
 * Response: { success, message, user: { id, name, email, role, isEmailVerified } }
 * Errors: 400 (validation), 409 (email exists — generic message)
 */
authRouter.post(
  '/register',
  authRateLimiter,
  validate(RegisterSchema),
  authController.register
);

/**
 * POST /api/auth/login
 * Log in with email and password. Sets httpOnly access + refresh token cookies.
 * Rate limited: 5 req/15min per IP
 * Public route.
 * Body: { email, password }
 * Response: { success, user: { id, name, email, role, isEmailVerified } }
 * Errors: 400 (validation), 401 (invalid credentials)
 */
authRouter.post(
  '/login',
  authRateLimiter,
  validate(LoginSchema),
  authController.login
);

/**
 * POST /api/auth/refresh
 * Exchange a refresh token cookie for new access + refresh token cookies.
 * Public route (no accessToken required — only refreshToken cookie).
 * Response: { success: true }
 * Errors: 401 (invalid/expired/reused refresh token)
 */
authRouter.post('/refresh', authController.refresh);

/**
 * POST /api/auth/logout
 * Clear token cookies and invalidate the refresh token in the database.
 * Auth required (but returns 200 even if not authenticated — idempotent).
 * Response: { success, message }
 */
authRouter.post('/logout', authenticate, authController.logout);

/**
 * GET /api/auth/verify-email/:token
 * Verify email address with the one-time token from the verification email.
 * Public route.
 * Params: token (string)
 * Response: { success, message }
 * Errors: 400 (invalid/expired token)
 */
authRouter.get('/verify-email/:token', authController.verifyEmail);

/**
 * POST /api/auth/resend-verification
 * Resend email verification link.
 * Rate limited: 5 req/15min per IP
 * Public route. Returns the same message regardless of outcome (prevents enumeration).
 * Body: { email }
 * Response: { success, message }
 */
authRouter.post(
  '/resend-verification',
  authRateLimiter,
  validate(ResendVerificationSchema),
  authController.resendVerification
);

/**
 * GET /api/auth/me
 * Get the currently authenticated user's profile.
 * Auth required.
 * Response: { success, user: { id, email, role, isEmailVerified } }
 * Errors: 401 (not authenticated)
 */
authRouter.get('/me', authenticate, authController.getMe);
