import { z } from 'zod';

export const createCompanySchema = z.object({
  legalName: z.string().min(2).max(200),
  displayName: z.string().min(2).max(200),
  pan: z.string().length(10).optional().or(z.literal('')),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  gstRegistered: z.boolean().default(false),
  businessType: z.enum(['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'OTHER']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().max(2).optional(),
  country: z.string().default('India'),
  pincode: z.string().optional(),
  financialYearStart: z.number().min(1).max(12).default(4),
  currency: z.string().default('INR'),
});

export const updateCompanySchema = createCompanySchema.partial();

export const updateInvoiceSettingsSchema = z.object({
  prefix: z.string().min(1).max(10),
  separator: z.string().max(2),
  includeFinancialYear: z.boolean(),
  financialYearFormat: z.enum(['YYYY-YY', 'YYYY-YYYY', 'YYYY']),
  numberLength: z.number().min(4).max(10),
});

export const updateBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountName: z.string().min(1),
  accountNumber: z.string().min(5),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
  branch: z.string().optional(),
  upiId: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const updateCompanySettingsSchema = z.object({
  defaultPaymentTerms: z.number().min(0).max(365).optional(),
  defaultNotes: z.string().optional(),
  defaultTerms: z.string().optional(),
  invoiceTemplate: z.enum(['classic', 'modern', 'professional', 'minimal']).optional(),
  accentColor: z.string().optional(),
  enableStockTracking: z.boolean().optional(),
  lowStockAlert: z.boolean().optional(),
  roundOffInvoice: z.boolean().optional(),
});
