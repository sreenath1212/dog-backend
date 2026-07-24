import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import type { CreateOrderInput } from './orders.validators';

/**
 * Get all orders for a specific user.
 * SECURITY: userId from JWT — a user cannot see another user's orders.
 */
export async function getUserOrders(userId: string, page = 1, limit = 20) {
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { userId }, // SECURITY: ownership enforced — only this user's orders
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            productImage: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

/**
 * Get a single order by ID, verifying ownership.
 * SECURITY: The query includes userId = req.user.id — a user cannot fetch another user's order
 * even if they know the order ID.
 */
export async function getOrderById(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId, // SECURITY: ownership check is part of the WHERE clause
    },
    include: { items: true },
  });

  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

/**
 * Create a pending order from the user's cart.
 * Called by the payments service before creating the Razorpay order.
 *
 * SECURITY: The total is calculated here from DB prices — this value is used for
 * Razorpay order creation. The frontend price is NEVER used.
 */
export async function createPendingOrder(
  userId: string,
  shippingInfo: CreateOrderInput
): Promise<{ order: Awaited<ReturnType<typeof prisma.order.create>>; totalAmount: number }> {
  // Fetch the user's cart with current product prices
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, images: true, price: true, stockQty: true, isActive: true },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError(400, 'Your cart is empty');
  }

  // Validate all items
  for (const item of cart.items) {
    if (!item.product.isActive) {
      throw new AppError(400, `"${item.product.name}" is no longer available`);
    }
    if (item.quantity > item.product.stockQty) {
      throw new AppError(
        400,
        `Insufficient stock for "${item.product.name}". Only ${item.product.stockQty} available.`
      );
    }
  }

  // SECURITY: Calculate total server-side from DB prices — never trust frontend totals.
  // This is the amount that will be charged via Razorpay.
  const totalAmount = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Create order and decrement stock atomically in a transaction
  // This prevents overselling — if stock runs out between checking and buying, the transaction fails
  const order = await prisma.$transaction(async (tx) => {
    // Decrement stock for each item (with optimistic locking via Prisma's atomic updates)
    for (const item of cart.items) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          stockQty: { gte: item.quantity }, // Only update if enough stock exists
        },
        data: { stockQty: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        throw new AppError(400, `"${item.product.name}" just ran out of stock. Please update your cart.`);
      }
    }

    // Create the order with a snapshot of item prices (not linked to current prices)
    return tx.order.create({
      data: {
        userId,
        totalAmount, // Server-calculated — authoritative
        status: 'PENDING',
        ...shippingInfo,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            productImage: item.product.images[0] ?? null,
            quantity: item.quantity,
            unitPrice: item.product.price, // Snapshot at time of purchase
          })),
        },
      },
    });
  });

  return { order, totalAmount };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Order not found');

  return prisma.order.update({
    where: { id: orderId },
    data: { status: status as never },
  });
}

export async function markOrderPaid(razorpayOrderId: string, razorpayPaymentId: string) {
  const order = await prisma.order.findUnique({ where: { razorpayOrderId } });
  if (!order) throw new AppError(404, 'Order not found for this payment');

  // Idempotency check — don't process the same payment twice
  if (order.status === 'PAID') {
    return order; // Already processed (e.g., duplicate webhook delivery)
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'PAID', razorpayPaymentId },
    include: { user: { select: { email: true, name: true } } },
  });

  return updated;
}

export async function getAllOrdersAdmin(page = 1, limit = 50) {
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true,
      },
    }),
    prisma.order.count(),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
