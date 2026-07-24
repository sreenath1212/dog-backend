import { Request, Response, NextFunction } from 'express';
import * as ordersService from './orders.service';

export async function getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ordersService.getUserOrders(req.user!.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getMyOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // SECURITY: Pass req.user!.id as ownership check — user cannot access another's order
    const order = await ordersService.getOrderById(req.params.id, req.user!.id);
    res.json({ success: true, order });
  } catch (err) { next(err); }
}
