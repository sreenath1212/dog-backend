import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
  CreateReviewSchema,
} from './products.validators';
import * as productsController from './products.controller';

export const productsRouter: Router = Router();

/**
 * GET /api/products
 * List products with optional filtering, search, and pagination.
 * Public route — no auth required.
 * Query: category, brand, minPrice, maxPrice, search, page, limit, sortBy
 * Response: { success, items: Product[], pagination: { page, limit, total, pages } }
 */
productsRouter.get(
  '/',
  validate(ProductQuerySchema, 'query'),
  productsController.getProducts
);

/**
 * GET /api/products/:slug
 * Get a single product by its URL slug.
 * Public route — no auth required.
 * Response: { success, product: Product & { reviews: Review[] } }
 * Errors: 404 (not found or inactive)
 */
productsRouter.get('/:slug', productsController.getProductBySlug);

/**
 * POST /api/products
 * Create a new product.
 * Auth required: ADMIN role
 * Body: CreateProductInput
 * Response: { success, product }
 * Errors: 400 (validation), 401, 403, 409 (slug taken)
 */
productsRouter.post(
  '/',
  authenticate,
  requireAdmin,
  validate(CreateProductSchema),
  productsController.createProduct
);

/**
 * PUT /api/products/:id
 * Update a product.
 * Auth required: ADMIN role
 * Body: Partial<CreateProductInput>
 * Response: { success, product }
 * Errors: 400, 401, 403, 404, 409
 */
productsRouter.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(UpdateProductSchema),
  productsController.updateProduct
);

/**
 * DELETE /api/products/:id
 * Soft-delete a product (sets isActive=false, preserving order history).
 * Auth required: ADMIN role
 * Response: { success, message }
 * Errors: 401, 403, 404
 */
productsRouter.delete('/:id', authenticate, requireAdmin, productsController.deleteProduct);

/**
 * POST /api/products/:id/images
 * Upload a product image. Multipart form-data, field name: "image"
 * Auth required: ADMIN role
 * Response: { success, url }
 * Errors: 400 (no file / wrong type), 401, 403, 404
 */
productsRouter.post(
  '/:id/images',
  authenticate,
  requireAdmin,
  productsController.uploadMiddleware,
  productsController.uploadImage
);

/**
 * POST /api/products/:id/reviews
 * Write or update a product review.
 * Auth required: Authenticated user (verified email)
 * SECURITY: Check user has purchased the product before writing review.
 * Body: { rating, title, body }
 * Response: { success, review }
 */
productsRouter.post(
  '/:id/reviews',
  authenticate,
  validate(CreateReviewSchema),
  productsController.createReview
);

