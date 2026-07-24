import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for auth endpoints (login, register, password reset).
 * 5 requests per 15 minutes per IP — prevents brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for checkout/payment endpoints.
 * 10 requests per hour per IP — prevents payment abuse.
 */
export const checkoutRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many checkout attempts. Please try again in an hour.',
  },
});

/**
 * General API rate limiter applied to all routes.
 * 100 requests per minute per IP — prevents general abuse.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});
