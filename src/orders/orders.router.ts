import { Router } from 'express';
import { authenticate, requireVerified } from '../middleware/authenticate';
import * as ordersController from './orders.controller';

export const ordersRouter: Router = Router();

ordersRouter.use(authenticate, requireVerified);

/**
 * GET /api/orders
 * Get all orders for the authenticated user.
 * Auth required: authenticated user (email verified)
 * SECURITY: Only returns orders where userId = req.user.id
 * Query: page, limit
 * Response: { success, items: Order[], pagination }
 */
ordersRouter.get('/', ordersController.getMyOrders);

/**
 * GET /api/orders/:id
 * Get a single order by ID.
 * Auth required: authenticated user
 * SECURITY: Ownership check — returns 404 if the order doesn't belong to this user
 *           (prevents IDOR — a user cannot view another user's order by guessing the ID)
 * Response: { success, order: Order & { items: OrderItem[] } }
 * Errors: 404 (not found or not owned by user)
 */
ordersRouter.get('/:id', ordersController.getMyOrderById);
