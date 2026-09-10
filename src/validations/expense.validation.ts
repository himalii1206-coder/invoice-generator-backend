import { z } from 'zod';

export const createExpenseSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string(),
  method: z
    .enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'])
    .default('CASH'),
  vendor: z.string().optional(),
  payeeName: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const createStockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().or(z.string().transform((v) => parseFloat(v))),
  type: z.enum(['IN', 'OUT', 'CORRECTION', 'ADD', 'SUBTRACT', 'SET']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const stockAdjustmentSchema = createStockAdjustmentSchema;
