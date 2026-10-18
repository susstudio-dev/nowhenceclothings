// zod schemas for admin API request bodies.
import { z } from 'zod';
import { Email, IsoDate, Paise } from '@/lib/schemas/common';
import { Product, SizeChart } from '@/lib/schemas/catalogue';
import { Coupon } from '@/lib/schemas/coupons';
import { OrderStatus, Tracking } from '@/lib/schemas/order';
import { RoleId } from '@/lib/schemas/users';

export const LoginInput = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

/** Products: server owns createdAt/updatedAt. */
export const ProductBody = Product.omit({ createdAt: true, updatedAt: true }).extend({
  createdAt: IsoDate.optional(),
  updatedAt: IsoDate.optional(),
});
export type ProductBody = z.infer<typeof ProductBody>;

export const ProductStatusInput = z.object({ status: z.enum(['draft', 'active', 'archived']) });

export const StockInput = z.object({
  edits: z
    .array(
      z.object({
        sku: z.string().min(1).max(40),
        stock: z.number().int().min(0).max(100000).optional(),
        lowStockAt: z.number().int().min(0).max(10000).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const OrderPatchInput = z
  .object({
    status: OrderStatus.optional(),
    note: z.string().max(500).optional(),
    tracking: Tracking.nullable().optional(),
    notes: z.string().max(2000).optional(),
    refund: z
      .object({ amount: Paise.min(1), reason: z.string().max(300).optional(), razorpayRefundId: z.string().max(80).optional() })
      .optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), 'Nothing to change');

/** Coupons: usedCount and createdAt are server-owned (merged on save). */
export const CouponInput = z.object({ coupon: Coupon });

export const SizeChartInput = z.object({ chart: SizeChart });

export const SaleInput = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(500),
  percentOff: z.number().min(0).max(90),
  saleEndsAt: IsoDate.optional(),
});

export const InviteInput = z.object({
  email: Email,
  name: z.string().trim().max(100).default(''),
  role: RoleId,
});

export const UserPatchInput = z.object({
  role: RoleId.optional(),
  status: z.enum(['active', 'disabled']).optional(),
  name: z.string().trim().max(100).optional(),
  resetPassword: z.boolean().optional(),
});

export const ChangePasswordInput = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10, 'Use at least 10 characters').max(200),
});

export const RestoreInput = z.object({ key: z.string().min(1).max(200) });
