# Admin Module

## What This Module Does

Provides API endpoints exclusively for users with the ADMIN role to manage the store — view/update products, manage orders, view users, and see dashboard statistics.

## Key Files

| File | Purpose |
|---|---|
| `admin.controller.ts` | All admin HTTP handlers |
| `admin.router.ts` | Route definitions |

## Security: Double Authorization

Every admin route is protected by two middleware in sequence:
1. `authenticate` — verifies the JWT access token and confirms the user exists in the database
2. `requireAdmin` — checks that `req.user.role === 'ADMIN'`

Both checks happen on every request — not just at login time. If an admin's role is revoked in the database, their next API request will be rejected.

```typescript
// admin.router.ts
adminRouter.use(authenticate, requireAdmin); // Applied to ALL admin routes
```

## Security: Safe User Data

The users endpoint explicitly selects only safe fields using Prisma's `select`:
```typescript
select: {
  id: true, name: true, email: true, role: true,
  isEmailVerified: true, createdAt: true,
  _count: { select: { orders: true } }
  // passwordHash: NEVER selected
  // refreshTokenHash: NEVER selected
}
```

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | /api/admin/stats | Dashboard statistics |
| GET | /api/admin/products | All products (including inactive) |
| PATCH | /api/admin/products/:id/stock | Manually set stock quantity |
| GET | /api/admin/orders | All orders with user+item details |
| PATCH | /api/admin/orders/:id/status | Update order status |
| GET | /api/admin/users | All users (safe fields only) |
