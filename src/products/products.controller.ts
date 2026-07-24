import { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import * as productsService from './products.service';

// Multer configuration — stores files in memory then delegates to StorageProvider
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

export const uploadMiddleware: RequestHandler = upload.single('image');

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productsService.getProducts(req.query as never);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await productsService.getProductBySlug(req.params.slug);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.createProduct(req.body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateProduct(req.params.id, req.body);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await productsService.softDeleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    next(err);
  }
}

export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No image file provided' });
      return;
    }

    // Generate a unique filename to prevent path traversal and overwrites
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;

    const url = await productsService.addProductImage(req.params.id, filename, req.file.buffer);
    res.status(201).json({ success: true, url });
  } catch (err) {
    next(err);
  }
}

export async function createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await productsService.createReview(req.params.id, req.user!.id, req.body);
    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

