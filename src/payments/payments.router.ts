import { Router } from 'express';
import { authenticate, requireVerified } from '../middleware/authenticate';
import { checkoutRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { CreateOrderSchema } from '../orders/orders.validators';
import * as paymentsController from './payments.controller';

export const paymentsRouter: Router = Router();

/**
 * POST /api/payments/create-razorpay-order
 * Create a Razorpay payment order and return the order details for the frontend checkout.
 *
 * Auth required: authenticated user (email verified)
 * Rate limited: 10 requests per hour per IP
 *
 * SECURITY:
 * - Total amount is recalculated server-side from DB prices — frontend price is NEVER used
 * - Stock is decremented atomically — prevents overselling
 * - Rate limited to prevent payment abuse
 *
 * Body: { shippingName, shippingAddress, shippingCity, shippingState, shippingPincode, shippingPhone }
 * Response: { success, razorpayOrderId, razorpayKeyId, amount (paise), currency, orderId }
 * Errors: 400 (empty cart, out of stock), 401, 403, 500 (Razorpay API failure)
 */
paymentsRouter.post(
  '/create-razorpay-order',
  authenticate,
  requireVerified,
  checkoutRateLimiter,
  validate(CreateOrderSchema),
  paymentsController.createRazorpayOrder
);

/**
 * POST /api/payments/webhook
 * Receive and process Razorpay payment webhook events.
 *
 * Auth: HMAC-SHA256 signature verification (not JWT — Razorpay is a server, not a browser)
 * CSRF: Excluded (configured in app.ts) — Razorpay is a server-to-server call
 *
 * SECURITY:
 * - Signature verified BEFORE any order status is updated
 * - Raw body (Buffer) used for signature — parsing would break the HMAC
 * - Idempotent — processing the same payment twice is safe
 *
 * Headers: X-Razorpay-Signature (HMAC-SHA256 of raw body)
 * Response: { success: true } (always — Razorpay retries on non-2xx)
 * Errors: 400 (missing/invalid signature)
 */
paymentsRouter.post('/webhook', paymentsController.handleWebhook);
