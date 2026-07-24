# Orders Module

## What This Module Does

Manages the full order lifecycle — from creation (triggered by the payments module) through status updates, and presenting order history to users.

## Order Lifecycle

```
PENDING → (webhook received) → PAID → PROCESSING → SHIPPED → DELIVERED
                                  ↘ CANCELLED ↙
                                  ↘ REFUNDED ↙
```

| Status | Set by | Meaning |
|---|---|---|
| PENDING | payments.service.ts | Order created, payment not yet confirmed |
| PAID | payments.service.ts (webhook) | Razorpay confirmed payment |
| PROCESSING | Admin panel | Admin has started preparing the order |
| SHIPPED | Admin panel | Order dispatched |
| DELIVERED | Admin panel | Customer received the order |
| CANCELLED | Admin or system | Order cancelled before shipment |
| REFUNDED | Admin | Payment refunded |

## Key Files

| File | Purpose |
|---|---|
| `orders.validators.ts` | Zod schemas for create/status-update inputs |
| `orders.service.ts` | All business logic including server-side total calculation |
| `orders.controller.ts` | HTTP handlers |
| `orders.router.ts` | Route definitions |

## Security: Ownership Checks

Every user-facing order query includes `userId: req.user.id` in the WHERE clause. A user who knows another user's order ID will receive a 404 — not a 403 (which would confirm the order exists).

```typescript
// orders.service.ts
const order = await prisma.order.findFirst({
  where: {
    id: orderId,
    userId, // SECURITY: must match the authenticated user
  },
});
```

## Security: Server-Side Total

The `createPendingOrder` function calculates the total from the database:
```typescript
const totalAmount = cart.items.reduce(
  (sum, item) => sum + item.product.price * item.quantity, 0
);
```
This value is then passed to the Razorpay API. The frontend never provides a price.

## Security: Atomic Stock Decrement

Stock is decremented inside a `prisma.$transaction` with an optimistic lock:
```typescript
await tx.product.updateMany({
  where: { id: item.productId, stockQty: { gte: item.quantity } },
  data: { stockQty: { decrement: item.quantity } },
});
```
If `updateMany.count === 0`, the product ran out of stock between the check and the update — the transaction is rolled back and the user is informed.

## Price Snapshots

`OrderItem.unitPrice` and `OrderItem.productName` store the values **at time of purchase**. If a product's price or name changes later, historical orders still show the original values.
