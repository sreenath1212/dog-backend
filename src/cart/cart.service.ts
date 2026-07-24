import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import type { AddCartItemInput, UpdateCartItemInput } from './cart.validators';

/**
 * Get or create the cart for a user.
 * SECURITY: userId always comes from req.user.id (the authenticated JWT),
 * never from request body or params — a user cannot access another user's cart.
 */
async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              images: true,
              stockQty: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function getCart(userId: string) {
  return getOrCreateCart(userId);
}

export async function addItem(userId: string, input: AddCartItemInput) {
  const cart = await getOrCreateCart(userId);

  // Verify the product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: input.productId, isActive: true },
  });
  if (!product) throw new AppError(404, 'Product not found');
  if (product.stockQty < 1) throw new AppError(400, 'Product is out of stock');

  // Upsert the cart item — if it exists, increment quantity; if not, create it
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
  });

  if (existingItem) {
    const newQty = existingItem.quantity + input.quantity;
    if (newQty > product.stockQty) {
      throw new AppError(400, `Only ${product.stockQty} unit(s) available`);
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQty },
    });
  } else {
    if (input.quantity > product.stockQty) {
      throw new AppError(400, `Only ${product.stockQty} unit(s) available`);
    }
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: input.productId, quantity: input.quantity },
    });
  }

  return getOrCreateCart(userId);
}

export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateCartItemInput
) {
  // SECURITY: Find the cart item AND verify it belongs to this user's cart
  // in a single query — prevents a user from updating another user's cart item.
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(404, 'Cart not found');

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id }, // ownership enforced here
    include: { product: { select: { stockQty: true } } },
  });
  if (!item) throw new AppError(404, 'Cart item not found');

  if (input.quantity > item.product.stockQty) {
    throw new AppError(400, `Only ${item.product.stockQty} unit(s) available`);
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity: input.quantity },
  });

  return getOrCreateCart(userId);
}

export async function removeItem(userId: string, itemId: string) {
  // SECURITY: Verify the item belongs to this user's cart before deleting
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(404, 'Cart not found');

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id }, // ownership enforced here
  });
  if (!item) throw new AppError(404, 'Cart item not found');

  await prisma.cartItem.delete({ where: { id: itemId } });
  return getOrCreateCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;

  // SECURITY: Delete only items in this user's cart (where: { cartId: cart.id })
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}
