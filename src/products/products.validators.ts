import { z } from 'zod';
import { Category } from '@prisma/client';

export const CreateProductSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  description: z.string().min(10).trim(),
  price: z.number().int().positive('Price must be a positive integer in paise'),
  compareAtPrice: z.number().int().positive().optional(),
  category: z.nativeEnum(Category),
  brand: z.string().max(100).trim().optional(),
  tags: z.array(z.string().trim()).default([]),
  stockQty: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductQuerySchema = z.object({
  category: z.nativeEnum(Category).optional(),
  brand: z.string().trim().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'name_asc']).default('newest'),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).trim().optional(),
  body: z.string().min(3).max(1000).trim(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

