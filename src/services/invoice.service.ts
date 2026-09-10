import prisma from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/middleware/error.middleware';
import { calculateInvoiceTotals } from '@/lib/gst-calculator';
import { generateInvoiceNumber } from '@/lib/invoice-number';
import { parsePaginationQuery } from '@/lib/api-response';
import type { createInvoiceSchema, recordPaymentSchema } from '@/validations/invoice.validation';
import type { z } from 'zod';
import Decimal from 'decimal.js';

export const invoiceService = {
  async list(companyId: string, query: Record<string, unknown>) {
    const { page, limit, search, sortBy, sortOrder, skip } = parsePaginationQuery(query);
    const status = typeof query.status === 'string' ? query.status : undefined;
    const customerId = typeof query.customerId === 'string' ? query.customerId : undefined;
    const fromDate = typeof query.fromDate === 'string' ? new Date(query.fromDate) : undefined;
    const toDate = typeof query.toDate === 'string' ? new Date(query.toDate) : undefined;

    const where = {
      companyId,
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
          { customerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(fromDate && toDate && { invoiceDate: { gte: fromDate, lte: toDate } }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          customerName: true,
          customerGstin: true,
          subtotal: true,
          grandTotal: true,
          paidAmount: true,
          outstandingAmount: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy ?? 'invoiceDate']: sortOrder },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { data: invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: { include: { addresses: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        taxBreakdowns: true,
        invoicePayments: {
          include: {
            payment: true,
          },
        },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        company: {
          select: {
            displayName: true,
            legalName: true,
            logoUrl: true,
            gstin: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            stateCode: true,
            pincode: true,
            phone: true,
            email: true,
            bankAccounts: { where: { isPrimary: true }, take: 1 },
            settings: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  },

  async create(
    companyId: string,
    userId: string,
    data: z.infer<typeof createInvoiceSchema>,
  ) {
    // Validate customer belongs to company
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
      include: {
        addresses: { where: { type: 'BILLING', isPrimary: true } },
      },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Determine if inter-state based on place of supply vs company state
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stateCode: true, state: true },
    });

    const placeOfSupply = data.placeOfSupply ?? customer.addresses[0]?.stateCode ?? company?.stateCode ?? '';
    const isInterState = !!company?.stateCode && placeOfSupply !== company.stateCode;

    // Calculate all totals server-side
    const calc = calculateInvoiceTotals({
      items: data.items,
      isInterState,
      invoiceDiscountType: data.invoiceDiscountType,
      invoiceDiscountValue: data.invoiceDiscountValue,
      otherCharges: data.otherCharges,
      shippingCharges: data.shippingCharges,
    });

    return prisma.$transaction(async (tx) => {
      // Generate invoice number atomically
      const invoiceNumber = await generateInvoiceNumber(companyId, tx);

      // Customer address snapshot
      const billingAddr = customer.addresses[0];
      const customerAddress = billingAddr
        ? [billingAddr.addressLine1, billingAddr.addressLine2, billingAddr.city, billingAddr.state, billingAddr.pincode]
            .filter(Boolean)
            .join(', ')
        : undefined;

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          customerId: data.customerId,
          invoiceNumber,
          type: data.type,
          status: 'ISSUED',
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          placeOfSupply,
          isInterState,
          paymentTerms: data.paymentTerms,

          // Customer snapshot
          customerName: customer.name,
          customerGstin: customer.gstin ?? undefined,
          customerAddress,
          customerState: billingAddr?.state,
          customerStateCode: billingAddr?.stateCode ?? undefined,

          // Totals
          subtotal: calc.subtotal,
          discountAmount: calc.discountAmount,
          taxableAmount: calc.taxableAmount,
          cgstAmount: calc.cgstAmount,
          sgstAmount: calc.sgstAmount,
          igstAmount: calc.igstAmount,
          cessAmount: calc.cessAmount,
          otherCharges: calc.otherCharges,
          shippingCharges: calc.shippingCharges,
          roundOff: calc.roundOff,
          grandTotal: calc.grandTotal,
          outstandingAmount: calc.grandTotal,
          paidAmount: '0',

          invoiceDiscountType: data.invoiceDiscountType,
          invoiceDiscountValue: data.invoiceDiscountValue,
          notes: data.notes,
          terms: data.terms,
        },
      });

      // Create invoice items (with snapshots)
      await tx.invoiceItem.createMany({
        data: data.items.map((item, idx) => {
          const itemCalc = calc.itemCalculations[idx];
          return {
            invoiceId: invoice.id,
            productId: item.productId,
            taxRateId: item.taxRateId,
            unitId: item.unitId,
            productName: item.productName,
            productSku: item.productSku,
            hsnSac: item.hsnSac,
            unitName: item.unitName,
            quantity: itemCalc.quantity,
            rate: itemCalc.rate,
            discountType: item.discountType,
            discountValue: item.discountValue ?? '0',
            discountAmount: itemCalc.discountAmount,
            taxableAmount: itemCalc.taxableAmount,
            taxRate: item.taxRate ?? '0',
            cgstRate: itemCalc.cgstRate,
            cgstAmount: itemCalc.cgstAmount,
            sgstRate: itemCalc.sgstRate,
            sgstAmount: itemCalc.sgstAmount,
            igstRate: itemCalc.igstRate,
            igstAmount: itemCalc.igstAmount,
            cessRate: itemCalc.cessRate,
            cessAmount: itemCalc.cessAmount,
            totalAmount: itemCalc.totalAmount,
            sortOrder: item.sortOrder ?? idx,
          };
        }),
      });

      // Create tax breakdowns
      if (calc.taxBreakdowns.length > 0) {
        await tx.invoiceTax.createMany({
          data: calc.taxBreakdowns.map((tb) => ({
            invoiceId: invoice.id,
            taxName: tb.taxName,
            taxType: tb.taxType,
            taxRate: tb.taxRate,
            taxableAmount: tb.taxableAmount,
            taxAmount: tb.taxAmount,
          })),
        });
      }

      // Deduct stock for goods items (in transaction)
      for (const item of data.items) {
        if (!item.productId) continue;

        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId, isStockTracked: true, type: 'GOODS' },
        });

        if (!product) continue;

        const qty = new Decimal(item.quantity);
        const newStock = new Decimal(product.currentStock.toString()).minus(qty);

        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: newStock.toString() },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            productId: product.id,
            type: 'SALE',
            quantity: qty.negated().toString(),
            balanceBefore: product.currentStock.toString(),
            balanceAfter: newStock.toString(),
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            createdBy: userId,
          },
        });
      }

      // Create initial status history
      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: invoice.id,
          status: 'ISSUED',
          note: 'Invoice created',
          changedBy: userId,
        },
      });

      return invoice;
    });
  },

  async recordPayment(
    companyId: string,
    invoiceId: string,
    userId: string,
    data: z.infer<typeof recordPaymentSchema>,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new NotFoundError('Invoice');

    if (invoice.status === 'CANCELLED') {
      throw new ValidationError('Cannot record payment for a cancelled invoice');
    }

    const paymentAmount = new Decimal(data.amount);
    const outstanding = new Decimal(invoice.outstandingAmount.toString());

    if (paymentAmount.lte(0)) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (paymentAmount.gt(outstanding)) {
      throw new ValidationError(
        `Payment amount (${paymentAmount.toFixed(2)}) exceeds outstanding balance (${outstanding.toFixed(2)})`,
      );
    }

    return prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          companyId,
          customerId: invoice.customerId,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          method: data.method,
          referenceNumber: data.referenceNumber,
          chequeNumber: data.chequeNumber,
          bankName: data.bankName,
          notes: data.notes,
        },
      });

      // Link payment to invoice
      await tx.invoicePayment.create({
        data: { invoiceId, paymentId: payment.id },
      });

      // Update invoice paid/outstanding amounts
      const newPaid = new Decimal(invoice.paidAmount.toString()).plus(paymentAmount);
      const newOutstanding = outstanding.minus(paymentAmount);
      const newStatus = newOutstanding.eq(0)
        ? 'PAID'
        : newPaid.gt(0)
          ? 'PARTIALLY_PAID'
          : invoice.status;

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid.toString(),
          outstandingAmount: newOutstanding.toString(),
          status: newStatus,
        },
      });

      if (newStatus !== invoice.status) {
        await tx.invoiceStatusHistory.create({
          data: {
            invoiceId,
            status: newStatus,
            note: `Payment of ₹${paymentAmount.toFixed(2)} recorded via ${data.method}`,
            changedBy: userId,
          },
        });
      }

      return payment;
    });
  },

  async cancelInvoice(
    companyId: string,
    invoiceId: string,
    userId: string,
    reason: string,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundError('Invoice');

    if (invoice.status === 'CANCELLED') {
      throw new ValidationError('Invoice is already cancelled');
    }

    if (['PAID'].includes(invoice.status)) {
      throw new ValidationError('Cannot cancel a fully paid invoice');
    }

    return prisma.$transaction(async (tx) => {
      // Restore stock for goods items
      for (const item of invoice.items) {
        if (!item.productId) continue;

        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId, isStockTracked: true },
        });
        if (!product) continue;

        const qty = new Decimal(item.quantity.toString());
        const newStock = new Decimal(product.currentStock.toString()).plus(qty);

        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: newStock.toString() },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            productId: product.id,
            type: 'RETURN',
            quantity: qty.toString(),
            balanceBefore: product.currentStock.toString(),
            balanceAfter: newStock.toString(),
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            notes: `Invoice cancelled: ${reason}`,
            createdBy: userId,
          },
        });
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId,
          status: 'CANCELLED',
          note: reason,
          changedBy: userId,
        },
      });
    });
  },

  // Mark overdue invoices (called by a scheduled job)
  async markOverdueInvoices() {
    const now = new Date();
    return prisma.invoice.updateMany({
      where: {
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
  },

  async getStatusCounts(companyId: string) {
    const counts = await prisma.invoice.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    counts.forEach((c) => {
      result[c.status] = c._count.id;
    });
    return result;
  },
};
