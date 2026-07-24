import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import * as productsService from '../products/products.service';
import * as ordersService from '../orders/orders.service';

// ── Products ────────────────────────────────────────────────────────────────

export async function adminGetProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await productsService.adminGetProducts(page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function adminUpdateStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stockQty } = req.body;
    if (typeof stockQty !== 'number' || stockQty < 0) {
      throw new AppError(400, 'stockQty must be a non-negative number');
    }
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { stockQty },
    });
    res.json({ success: true, product });
  } catch (err) { next(err); }
}

// ── Orders ──────────────────────────────────────────────────────────────────

export async function adminGetOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await ordersService.getAllOrdersAdmin(page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function adminUpdateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body;
    const order = await ordersService.updateOrderStatus(req.params.id, status);
    res.json({ success: true, order });
  } catch (err) { next(err); }
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function adminGetUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        // SECURITY: Explicitly select only safe fields — passwordHash and refreshTokenHash
        // are NEVER returned in any API response
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
}

// ── Dashboard Stats ─────────────────────────────────────────────────────────

export async function adminGetStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalOrders, totalUsers, totalProducts, revenueResult] = await prisma.$transaction([
      prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { totalAmount: true },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalUsers,
        totalProducts,
        totalRevenuePaise: revenueResult._sum.totalAmount ?? 0,
      },
    });
  } catch (err) { next(err); }
}
