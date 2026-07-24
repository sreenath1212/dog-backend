# Cart Module

## What This Module Does

Manages the shopping cart for authenticated users. The cart is stored in the PostgreSQL database (not in the browser), so it persists across page refreshes and device switches.

## How It Works

1. When a user first accesses their cart, it is created automatically if it doesn't exist
2. Products can be added, quantity updated, or removed individually
3. The entire cart is returned after every mutation (add/update/remove) so the frontend stays in sync
4. Stock availability is checked on every add/update — adding more than available stock is rejected

## Key Files

| File | Purpose |
|---|---|
| `cart.validators.ts` | Zod schemas for add/update inputs |
| `cart.service.ts` | All business logic — ownership enforcement, stock checks |
| `cart.controller.ts` | HTTP handlers |
| `cart.router.ts` | Route definitions |

## Security: Ownership Enforcement

This is the critical security property of the cart module: **a user can only ever access and modify their own cart**.

This is enforced at the database query level, not just with an if-statement. Every service function receives `userId` from `req.user.id` (the verified JWT payload) — it is never taken from the request body or URL parameters.

For operations on individual cart items (update quantity, remove), the query includes both the item ID and the user's cart ID:
```
WHERE id = :itemId AND cartId = :userCartId
```
This means even if a user knows another user's cart item ID, the query will return nothing — the request will fail with a 404.

## API Routes

See `cart.router.ts` for the full route documentation.
