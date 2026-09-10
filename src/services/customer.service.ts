import prisma from '@/lib/db';
import { NotFoundError } from '@/middleware/error.middleware';
import { parsePaginationQuery } from '@/lib/api-response';
import type { createCustomerSchema, updateCustomerSchema } from '@/validations/customer.validation';
import type { z } from 'zod';

export const customerService = {
  async getCustomers(companyId: string, query: any, search?: string, type?: string) {
    const { page, limit, skip } = parsePaginationQuery(query);

    const where: any = { companyId, isActive: true };
    if (type) where.customerType = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          addresses: true,
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    // Calculate outstanding balance per customer from invoices
    const customerIds = items.map((c) => c.id);
    const outstandingSums = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        companyId,
        customerId: { in: customerIds },
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { outstandingAmount: true },
    });

    const outstandingMap = new Map(
      outstandingSums.map((s) => [s.customerId, s._sum.outstandingAmount?.toString() || '0.00'])
    );

    const customersWithBalance = items.map((item) => ({
      ...item,
      outstandingAmount: outstandingMap.get(item.id) || '0.00',
    }));

    return {
      items: customersWithBalance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getCustomerById(companyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, isActive: true },
      include: {
        addresses: true,
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            grandTotal: true,
            paidAmount: true,
            outstandingAmount: true,
            status: true,
          },
        },
        payments: {
          take: 10,
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!customer) throw new NotFoundError('Customer');

    const outstandingSum = await prisma.invoice.aggregate({
      where: {
        companyId,
        customerId,
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { outstandingAmount: true },
    });

    return {
      ...customer,
      outstandingAmount: outstandingSum._sum.outstandingAmount?.toString() || '0.00',
    };
  },

  async createCustomer(companyId: string, data: z.infer<typeof createCustomerSchema>, userId?: string) {
    const { billingAddress, shippingAddress, ...customerData } = data;

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          ...customerData,
          companyId,
        },
      });

      if (billingAddress) {
        await tx.customerAddress.create({
          data: {
            customerId: customer.id,
            type: 'BILLING',
            ...billingAddress,
            isPrimary: true,
          },
        });
      }

      if (shippingAddress) {
        await tx.customerAddress.create({
          data: {
            customerId: customer.id,
            type: 'SHIPPING',
            ...shippingAddress,
          },
        });
      }

      return tx.customer.findUnique({
        where: { id: customer.id },
        include: { addresses: true },
      });
    });
  },

  async updateCustomer(companyId: string, customerId: string, data: z.infer<typeof updateCustomerSchema>, userId?: string) {
    const { billingAddress, shippingAddress, ...customerData } = data;

    const existing = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw new NotFoundError('Customer');

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: customerData,
      });

      if (billingAddress) {
        await tx.customerAddress.deleteMany({
          where: { customerId, type: 'BILLING' },
        });
        await tx.customerAddress.create({
          data: {
            customerId,
            type: 'BILLING',
            ...billingAddress,
            isPrimary: true,
          },
        });
      }

      if (shippingAddress) {
        await tx.customerAddress.deleteMany({
          where: { customerId, type: 'SHIPPING' },
        });
        await tx.customerAddress.create({
          data: {
            customerId,
            type: 'SHIPPING',
            ...shippingAddress,
          },
        });
      }

      return tx.customer.findUnique({
        where: { id: customer.id },
        include: { addresses: true },
      });
    });
  },

  async deleteCustomer(companyId: string, customerId: string, userId?: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) throw new NotFoundError('Customer');

    await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    return { id: customerId };
  },
};
