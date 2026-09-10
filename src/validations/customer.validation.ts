import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  companyName: z.string().optional(),
  customerType: z.enum(['BUSINESS', 'INDIVIDUAL']).default('BUSINESS'),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z.string().length(10).optional().or(z.literal('')),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  creditLimit: z.string().default('0'),
  paymentTerms: z.number().min(0).max(365).default(30),
  notes: z.string().optional(),
  billingAddress: z
    .object({
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      stateCode: z.string().optional(),
      country: z.string().default('India'),
      pincode: z.string().optional(),
    })
    .optional(),
  shippingAddress: z
    .object({
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      stateCode: z.string().optional(),
      country: z.string().default('India'),
      pincode: z.string().optional(),
    })
    .optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
