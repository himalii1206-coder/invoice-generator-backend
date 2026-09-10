import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  taxRateId: z.string().optional(),
  type: z.enum(['GOODS', 'SERVICE']).default('GOODS'),
  hsn: z.string().optional(),
  sellingPrice: z.string().min(1, 'Selling price is required'),
  purchasePrice: z.string().default('0'),
  openingStock: z.string().default('0'),
  minStockLevel: z.string().default('0'),
  isStockTracked: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const createUnitSchema = z.object({
  name: z.string().min(1).max(50),
  shortName: z.string().min(1).max(10),
});

export const createTaxRateSchema = z.object({
  name: z.string().min(1).max(50),
  rate: z.string(),
  cgst: z.string(),
  sgst: z.string(),
  igst: z.string(),
  cess: z.string().default('0'),
  isDefault: z.boolean().default(false),
});
