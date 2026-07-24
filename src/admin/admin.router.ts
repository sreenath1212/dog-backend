import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import { UpdateProductSchema } from '../products/products.validators';
import { UpdateOrderStatusSchema } from '../orders/orders.validators';
import * as adminController from './admin.controller';

export const adminRouter: Router = Router();

// SECURITY: All admin routes require BOTH authentication AND the ADMIN role.
// These are applied as middleware to the entire router — no admin route is accessible
// without passing both checks.
adminRouter.use(authenticate, requireAdmin);

/**
 * GET /api/admin/stats
 * Dashboard statistics: total orders, users, products, revenue.
 * Auth required: ADMIN
 */
adminRouter.get('/stats', adminController.adminGetStats);

/**
 * GET /api/admin/products
 * List all products including inactive ones (for management).
 * Auth required: ADMIN
 * Query: page, limit
 */
adminRouter.get('/products', adminController.adminGetProducts);

/**
 * PATCH /api/admin/products/:id/stock
 * Manually adjust a product's stock quantity.
 * Auth required: ADMIN
 * Body: { stockQty: number }
 */
adminRouter.patch(
  '/products/:id/stock',
  validate(UpdateProductSchema.pick({ stockQty: true })),
  adminController.adminUpdateStock
);

/**
 * GET /api/admin/orders
 * List all orders with user and item details.
 * Auth required: ADMIN
 * Query: page, limit
 */
adminRouter.get('/orders', adminController.adminGetOrders);

/**
 * PATCH /api/admin/orders/:id/status
 * Update an order's status (e.g., mark as SHIPPED).
 * Auth required: ADMIN
 * Body: { status: OrderStatus }
 */
adminRouter.patch(
  '/orders/:id/status',
  validate(UpdateOrderStatusSchema),
  adminController.adminUpdateOrderStatus
);

/**
 * GET /api/admin/users
 * List all users (safe fields only — no passwords or tokens).
 * Auth required: ADMIN
 * Query: page, limit
 */
adminRouter.get('/users', adminController.adminGetUsers);
