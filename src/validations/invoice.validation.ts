import { z } from 'zod';

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Product name is required'),
  productSku: z.string().optional(),
  hsnSac: z.string().optional(),
  unitId: z.string().optional(),
  unitName: z.string().optional(),
  taxRateId: z.string().optional(),
  quantity: z.string().min(1),
  rate: z.string().min(1),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.string().optional(),
  taxRate: z.string().default('0'),
  cgstRate: z.string().default('0'),
  sgstRate: z.string().default('0'),
  igstRate: z.string().default('0'),
  cessRate: z.string().default('0'),
  sortOrder: z.number().default(0),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  type: z
    .enum(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'PROFORMA'])
    .default('TAX_INVOICE'),
  invoiceDate: z.string().datetime().or(z.string().date()),
  dueDate: z.string().datetime().or(z.string().date()).optional(),
  placeOfSupply: z.string().optional(),
  paymentTerms: z.number().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  invoiceDiscountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  invoiceDiscountValue: z.string().optional(),
  otherCharges: z.string().default('0'),
  shippingCharges: z.string().default('0'),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().refine(
  (data) => !data.items || data.items.length > 0,
  { message: 'At least one item is required', path: ['items'] },
);

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const recordPaymentSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  paymentDate: z.string().datetime().or(z.string().date()),
  method: z
    .enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'])
    .default('CASH'),
  referenceNumber: z.string().optional(),
  chequeNumber: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
});
