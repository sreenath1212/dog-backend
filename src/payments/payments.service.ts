import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { createPendingOrder, markOrderPaid } from '../orders/orders.service';
import { clearCart } from '../cart/cart.service';
import { sendOrderConfirmationEmail } from '../utils/mailer';
import type { CreateOrderInput } from '../orders/orders.validators';

// Initialize Razorpay client with API credentials from environment variables
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay payment order.
 *
 * Flow:
 * 1. Create a pending order in our DB (with server-calculated total from DB prices)
 * 2. Decrement stock atomically (prevents overselling)
 * 3. Create a Razorpay order using the server-calculated total (in paise)
 * 4. Return the Razorpay order ID and key to the frontend for the Razorpay checkout
 *
 * SECURITY: The total amount passed to Razorpay is calculated server-side from
 * database prices. The frontend cannot influence the charged amount.
 */
export async function createRazorpayOrder(userId: string, shippingInfo: CreateOrderInput) {
  // Step 1 & 2: Create pending order in DB + decrement stock atomically
  const { order, totalAmount } = await createPendingOrder(userId, shippingInfo);

  try {
    // Step 3: Create Razorpay order using the server-calculated total (in paise)
    // SECURITY: totalAmount comes from the database, not from the frontend request
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount, // Server-calculated — authoritative amount in paise
      currency: 'INR',
      receipt: order.id,
      notes: {
        orderId: order.id,
        userId,
      },
    });

    // Save Razorpay order ID to our DB for webhook lookup
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: razorpayOrder.id },
    });

    logger.info('Razorpay order created', {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: env.RAZORPAY_KEY_ID, // Public key — safe to send to frontend
      amount: totalAmount,
      currency: 'INR',
      orderId: order.id,
    };
  } catch (err) {
    // If Razorpay order creation fails, restore stock (rollback the decrement)
    logger.error('Razorpay order creation failed — rolling back stock', {
      orderId: order.id,
      error: (err as Error).message,
    });

    // Restore stock for each item
    const failedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    if (failedOrder) {
      for (const item of failedOrder.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
      // Cancel the pending order
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    }

    throw new AppError(500, 'Failed to create payment order. Please try again.');
  }
}

/**
 * Handle Razorpay payment webhook.
 *
 * SECURITY: Before processing any event:
 * 1. The raw request body is used for HMAC-SHA256 signature computation
 * 2. The computed signature is compared to the X-Razorpay-Signature header
 * 3. If they don't match, the request is rejected — prevents fake payment confirmations
 *
 * This function is idempotent — processing the same payment twice is safe.
 */
export async function handleWebhook(rawBody: Buffer, signature: string) {
  // SECURITY: Verify the webhook signature using HMAC-SHA256.
  // The raw body (before JSON parsing) MUST be used — parsing changes the byte order.
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Use a timing-safe comparison to prevent timing attacks on the signature check
  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );

  if (!signaturesMatch) {
    logger.warn('Razorpay webhook signature verification failed — possible fake webhook');
    throw new AppError(400, 'Invalid webhook signature');
  }

  // Parse the body after signature verification
  const event = JSON.parse(rawBody.toString());

  logger.info('Razorpay webhook received', { event: event.event });

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const razorpayOrderId: string = payment.order_id;
    const razorpayPaymentId: string = payment.id;

    // Mark order as PAID only after signature was verified above
    const order = await markOrderPaid(razorpayOrderId, razorpayPaymentId);

    // Clear the user's cart after successful payment
    await clearCart(order.userId);

    // Send order confirmation email (non-blocking)
    sendOrderConfirmationEmail(
      (order as any).user.email,
      (order as any).user.name ?? 'there',
      order.id,
      order.totalAmount
    ).catch(() => {});

    logger.info('Order marked as PAID', { orderId: order.id, razorpayPaymentId });
  }
}
