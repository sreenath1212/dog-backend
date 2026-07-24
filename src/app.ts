import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import path from 'path';

import { env } from './config/env';
import { generalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Route imports
import { authRouter } from './auth/auth.router';
import { productsRouter } from './products/products.router';
import { cartRouter } from './cart/cart.router';
import { ordersRouter } from './orders/orders.router';
import { paymentsRouter } from './payments/payments.router';
import { adminRouter } from './admin/admin.router';

export function createApp(): Application {
  const app = express();

  // ── Security headers (helmet sets X-Frame-Options, CSP, HSTS, etc.) ────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  // ── CORS — strict allowlist, never wildcard ─────────────────────────────────
  // SECURITY: Only listed frontend origins can make cross-origin requests.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., server-to-server, curl in dev)
        if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Required so cookies are sent with cross-origin requests
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    })
  );

  // ── Raw body parser for Razorpay webhook (must be before JSON parser) ───────
  // SECURITY: Webhook signature verification requires the raw, unparsed body.
  // The /api/payments/webhook route is registered BEFORE express.json() applies.
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

  // ── Body parsers ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Static file serving for uploads ──────────────────────────────────────────
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  // ── General rate limiting on all routes ──────────────────────────────────────
  app.use('/api', generalRateLimiter);

  // ── CSRF protection ──────────────────────────────────────────────────────────
  // SECURITY: Protects all state-changing routes (POST/PUT/PATCH/DELETE).
  // The webhook route is excluded because it comes from Razorpay servers,
  // not a browser — it uses signature verification instead.
  const csrfProtection = csrf({
    cookie: {
      httpOnly: false, // Must be readable by JS so the frontend can send it in a header
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  // Apply CSRF to all routes EXCEPT the Razorpay webhook
  app.use((req, res, next) => {
    if (req.path === '/api/payments/webhook') return next();
    csrfProtection(req as any, res as any, next as any);
  });

  // Endpoint to get CSRF token (frontend calls this on app load)
  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // ── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── 404 handler ──────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // ── Global error handler (must be last) ──────────────────────────────────────
  app.use(errorHandler);

  return app;
}
