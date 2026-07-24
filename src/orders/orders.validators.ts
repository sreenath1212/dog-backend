import { z } from 'zod';

export const CreateOrderSchema = z.object({
  shippingName: z.string().min(2).max(100).trim(),
  shippingAddress: z.string().min(5).max(300).trim(),
  shippingCity: z.string().min(2).max(100).trim(),
  shippingState: z.string().min(2).max(100).trim(),
  shippingPincode: z
    .string()
    .regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
  shippingPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
