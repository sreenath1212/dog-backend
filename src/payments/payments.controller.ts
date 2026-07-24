import { Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { CreateOrderSchema } from '../orders/orders.validators';
import * as paymentsService from './payments.service';

export async function createRazorpayOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await paymentsService.createRazorpayOrder(req.user!.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle Razorpay webhook.
 * NOTE: This route receives a raw Buffer body (set up in app.ts before JSON middleware).
 * CSRF protection is disabled for this route — Razorpay is a server, not a browser.
 * Authentication is handled by HMAC-SHA256 signature verification instead.
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing webhook signature' });
      return;
    }

    // req.body is a raw Buffer here (set by express.raw() in app.ts)
    await paymentsService.handleWebhook(req.body as Buffer, signature);

    // Always return 200 to Razorpay to acknowledge receipt
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export { validate, CreateOrderSchema };
