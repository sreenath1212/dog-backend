import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { storage } from '../utils/storage';
import { sanitizeUserContent } from '../utils/sanitize';
import type { CreateProductInput, UpdateProductInput, ProductQuery, CreateReviewInput } from './products.validators';

// ─── Public Catalog Queries ──────────────────────────────────────────────────

export async function getProducts(query: ProductQuery) {
  const { category, brand, minPrice, maxPrice, search, page, limit, sortBy } = query;

  // Build Prisma where clause — all conditions use Prisma's parameterized query builder.
  // SECURITY: No raw SQL string concatenation anywhere here.
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(category ? { category } : {}),
    ...(brand ? { brand: { equals: brand, mode: 'insensitive' } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    // SECURITY: Prisma's `contains` uses parameterized queries — not raw LIKE %input%
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
            { tags: { has: search } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sortBy === 'price_asc'
      ? { price: 'asc' }
      : sortBy === 'price_desc'
      ? { price: 'desc' }
      : sortBy === 'name_asc'
      ? { name: 'asc' }
      : { createdAt: 'desc' };

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        images: true,
        category: true,
        brand: true,
        stockQty: true,
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, 'A product with this slug already exists');

  return prisma.product.create({ data: input });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, 'Product not found');

  if (input.slug && input.slug !== product.slug) {
    const slugTaken = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new AppError(409, 'A product with this slug already exists');
  }

  return prisma.product.update({ where: { id }, data: input });
}

export async function softDeleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, 'Product not found');

  // Soft delete — set isActive to false, preserving order history integrity
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function addProductImage(id: string, filename: string, buffer: Buffer): Promise<string> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, 'Product not found');

  const savedPath = await storage.save(filename, buffer, 'image/jpeg');
  const url = storage.getUrl(savedPath);

  await prisma.product.update({
    where: { id },
    data: { images: { push: savedPath } },
  });

  return url;
}

export async function deleteProductImage(id: string, filename: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, 'Product not found');

  await storage.delete(filename);
  await prisma.product.update({
    where: { id },
    data: { images: product.images.filter((img) => img !== filename) },
  });
}

// Admin list (includes inactive products)
export async function adminGetProducts(page = 1, limit = 50) {
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count(),
  ]);
  return { items, total };
}

export async function createReview(productId: string, userId: string, input: CreateReviewInput) {
  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'Product not found');

  // Verify user has purchased and paid for this product
  // SECURITY: Prevents review generation by users who haven't bought the items
  const hasPurchased = await prisma.order.findFirst({
    where: {
      userId,
      status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      items: { some: { productId } },
    },
  });
  if (!hasPurchased) {
    throw new AppError(403, 'You can only review products you have purchased and paid for');
  }

  // Sanitize the review body to prevent XSS
  const sanitizedBody = sanitizeUserContent(input.body);
  const sanitizedTitle = input.title ? sanitizeUserContent(input.title) : undefined;

  return prisma.review.upsert({
    where: { userId_productId: { userId, productId } },
    update: {
      rating: input.rating,
      title: sanitizedTitle,
      body: sanitizedBody,
    },
    create: {
      userId,
      productId,
      rating: input.rating,
      title: sanitizedTitle,
      body: sanitizedBody,
    },
  });
}

