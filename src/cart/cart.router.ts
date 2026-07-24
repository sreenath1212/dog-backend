import { Router } from 'express';
import { authenticate, requireVerified } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { AddCartItemSchema, UpdateCartItemSchema } from './cart.validators';
import * as cartController from './cart.controller';

export const cartRouter: Router = Router();

// All cart routes require authentication AND email verification
cartRouter.use(authenticate, requireVerified);

/**
 * GET /api/cart
 * Get the current user's cart with all items and product details.
 * Auth required: authenticated user (email verified)
 * SECURITY: userId comes from req.user.id (JWT), never from request — a user cannot
 *           read another user's cart even if they know the cart ID.
 * Response: { success, cart: Cart & { items: CartItem[] } }
 */
cartRouter.get('/', cartController.getCart);

/**
 * POST /api/cart/items
 * Add a product to the cart (or increment quantity if already present).
 * Auth required: authenticated user
 * Body: { productId: string, quantity: number }
 * Response: { success, cart }
 * Errors: 400 (out of stock, insufficient stock), 404 (product not found)
 */
cartRouter.post('/items', validate(AddCartItemSchema), cartController.addItem);

/**
 * PUT /api/cart/items/:itemId
 * Update the quantity of a cart item.
 * Auth required: authenticated user
 * SECURITY: Ownership verified — item must belong to the authenticated user's cart.
 * Body: { quantity: number }
 * Response: { success, cart }
 * Errors: 400 (insufficient stock), 404 (item not found or not owned by user)
 */
cartRouter.put('/items/:itemId', validate(UpdateCartItemSchema), cartController.updateItem);

/**
 * DELETE /api/cart/items/:itemId
 * Remove a specific item from the cart.
 * Auth required: authenticated user
 * SECURITY: Ownership verified — item must belong to the authenticated user's cart.
 * Response: { success, cart }
 * Errors: 404 (item not found or not owned by user)
 */
cartRouter.delete('/items/:itemId', cartController.removeItem);

/**
 * DELETE /api/cart
 * Clear all items from the cart.
 * Auth required: authenticated user
 * SECURITY: Only clears items from the authenticated user's own cart.
 * Response: { success, message }
 */
cartRouter.delete('/', cartController.clearCart);
