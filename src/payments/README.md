# Payments Module

## What This Module Does

Handles the complete Razorpay payment flow — creating payment orders, processing webhook events, and updating order status after verified payment.

## Payment Flow

```
1. User fills shipping form and clicks "Pay"
         ↓
2. Frontend calls POST /api/payments/create-razorpay-order
         ↓
3. Backend creates a pending Order in our DB (with server-calculated total)
   Stock is decremented atomically at this point
         ↓
4. Backend creates a Razorpay Order via the Razorpay API (amount = DB total in paise)
         ↓
5. Backend returns { razorpayOrderId, razorpayKeyId, amount } to frontend
         ↓
6. Frontend opens the Razorpay checkout popup using these details
         ↓
7. User completes payment on Razorpay's hosted page
         ↓
8. Razorpay sends a webhook event to POST /api/payments/webhook
         ↓
9. Backend verifies the X-Razorpay-Signature header (HMAC-SHA256)
         ↓
10. If valid: order status updated to PAID, cart cleared, confirmation email sent
```

## Key Files

| File | Purpose |
|---|---|
| `payments.service.ts` | Razorpay order creation, webhook signature verification |
| `payments.controller.ts` | HTTP handlers |
| `payments.router.ts` | Route definitions with security documentation |

## Security Decisions

### Server-Side Total Recalculation
The frontend sends only the shipping address — **never a price**. The total is always fetched from the database:
```typescript
// payments.service.ts — createRazorpayOrder()
// SECURITY: totalAmount calculated from DB prices, not from frontend request
const totalAmount = cart.items.reduce(
  (sum, item) => sum + item.product.price * item.quantity, 0
);
```
This prevents a malicious user from modifying the price in browser DevTools or via API manipulation.

### Webhook Signature Verification
Before marking any order as paid, the webhook signature is verified using HMAC-SHA256:
```typescript
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(rawBody) // raw Buffer — not JSON parsed
  .digest('hex');
```
The raw request body is used (not the parsed JSON) because parsing changes the bytes. A `crypto.timingSafeEqual` comparison prevents timing attacks.

### Idempotency
The `markOrderPaid` function checks if an order is already PAID before updating it. This means receiving the same webhook twice (Razorpay may retry) is safe.

### Stock Rollback on Failure
If the Razorpay API call fails after stock has been decremented, the stock is restored and the pending order is cancelled.

### CSRF Exemption
The webhook endpoint is excluded from CSRF protection (in `app.ts`) because Razorpay's servers don't have CSRF tokens. The HMAC-SHA256 signature verification serves the same security purpose.
