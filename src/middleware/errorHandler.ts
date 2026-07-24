import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom error class for application-level errors.
 * Use this to throw errors with a specific HTTP status code.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware.
 *
 * SECURITY: This middleware logs the FULL error (including stack trace) server-side,
 * but returns only a sanitized, generic message to the client.
 * Stack traces, file paths, and internal details never reach the client.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log the full error server-side for debugging
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  if (err instanceof AppError) {
    // Known application error — safe to return the message to the client
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  // Handle CSRF token errors from the csurf middleware
  if ((err as { code?: string }).code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      success: false,
      error: 'Invalid CSRF token. Please refresh the page and try again.',
    });
    return;
  }

  // Unknown error — return generic message (NEVER expose stack trace to client)
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again.',
  });
}
