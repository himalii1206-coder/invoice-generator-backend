import prisma from '@/lib/db';
import Decimal from 'decimal.js';

export const reportService = {
  async getSalesReport(
    companyId: string,
    params: {
      fromDate?: string;
      toDate?: string;
      customerId?: string;
      productId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { fromDate, toDate, customerId, status, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      status: status ? status : { notIn: ['DRAFT', 'CANCELLED'] },
      ...(customerId && { customerId }),
      ...(fromDate && toDate && {
        invoiceDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      }),
    };

    const [invoices, total, aggregates] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          customerName: true,
          subtotal: true,
          discountAmount: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          grandTotal: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
        },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          subtotal: true,
          discountAmount: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          grandTotal: true,
          paidAmount: true,
          outstandingAmount: true,
        },
      }),
    ]);

    return {
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        grossSales: aggregates._sum.grandTotal?.toString() ?? '0',
        discounts: aggregates._sum.discountAmount?.toString() ?? '0',
        taxableAmount: aggregates._sum.taxableAmount?.toString() ?? '0',
        cgst: aggregates._sum.cgstAmount?.toString() ?? '0',
        sgst: aggregates._sum.sgstAmount?.toString() ?? '0',
        igst: aggregates._sum.igstAmount?.toString() ?? '0',
        cess: aggregates._sum.cessAmount?.toString() ?? '0',
        totalGst: new Decimal(aggregates._sum.cgstAmount?.toString() ?? '0')
          .plus(aggregates._sum.sgstAmount?.toString() ?? '0')
          .plus(aggregates._sum.igstAmount?.toString() ?? '0')
          .plus(aggregates._sum.cessAmount?.toString() ?? '0')
          .toFixed(2),
        netSales: aggregates._sum.paidAmount?.toString() ?? '0',
        outstanding: aggregates._sum.outstandingAmount?.toString() ?? '0',
      },
    };
  },

  async getGstReport(
    companyId: string,
    params: { fromDate?: string; toDate?: string },
  ) {
    const { fromDate, toDate } = params;

    const where = {
      companyId,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      ...(fromDate && toDate && {
        invoiceDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      }),
    };

    const [invoices, taxBreakdowns] = await Promise.all([
      prisma.invoice.aggregate({
        where,
        _sum: {
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          grandTotal: true,
        },
        _count: { id: true },
      }),
      prisma.invoiceTax.groupBy({
        by: ['taxType', 'taxName', 'taxRate'],
        where: { invoice: where },
        _sum: { taxableAmount: true, taxAmount: true },
        orderBy: [{ taxType: 'asc' }, { taxRate: 'asc' }],
      }),
    ]);

    const totalTax = new Decimal(invoices._sum.cgstAmount?.toString() ?? '0')
      .plus(invoices._sum.sgstAmount?.toString() ?? '0')
      .plus(invoices._sum.igstAmount?.toString() ?? '0')
      .plus(invoices._sum.cessAmount?.toString() ?? '0');

    return {
      summary: {
        invoiceCount: invoices._count.id,
        taxableAmount: invoices._sum.taxableAmount?.toString() ?? '0',
        cgst: invoices._sum.cgstAmount?.toString() ?? '0',
        sgst: invoices._sum.sgstAmount?.toString() ?? '0',
        igst: invoices._sum.igstAmount?.toString() ?? '0',
        cess: invoices._sum.cessAmount?.toString() ?? '0',
        totalTax: totalTax.toFixed(2),
        grandTotal: invoices._sum.grandTotal?.toString() ?? '0',
      },
      breakdown: taxBreakdowns.map((b) => ({
        taxType: b.taxType,
        taxName: b.taxName,
        taxRate: b.taxRate.toString(),
        taxableAmount: b._sum.taxableAmount?.toString() ?? '0',
        taxAmount: b._sum.taxAmount?.toString() ?? '0',
      })),
    };
  },

  async getPaymentReport(
    companyId: string,
    params: { fromDate?: string; toDate?: string },
  ) {
    const { fromDate, toDate } = params;

    const dateFilter =
      fromDate && toDate
        ? { paymentDate: { gte: new Date(fromDate), lte: new Date(toDate) } }
        : {};

    const [methodBreakdown, totalReceived, outstanding] = await Promise.all([
      prisma.payment.groupBy({
        by: ['method'],
        where: { companyId, ...dateFilter },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { companyId, ...dateFilter },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { companyId, status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { outstandingAmount: true },
      }),
    ]);

    return {
      totalReceived: totalReceived._sum.amount?.toString() ?? '0',
      outstanding: outstanding._sum.outstandingAmount?.toString() ?? '0',
      methodBreakdown: methodBreakdown.map((m) => ({
        method: m.method,
        total: m._sum.amount?.toString() ?? '0',
        count: m._count.id,
      })),
    };
  },

  async getExpenseReport(
    companyId: string,
    params: { fromDate?: string; toDate?: string },
  ) {
    const { fromDate, toDate } = params;

    const dateFilter =
      fromDate && toDate
        ? { date: { gte: new Date(fromDate), lte: new Date(toDate) } }
        : {};

    const [categoryBreakdown, total] = await Promise.all([
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: { companyId, ...dateFilter },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where: { companyId, ...dateFilter },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Get category names
    const categoryIds = categoryBreakdown.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return {
      totalExpenses: total._sum.amount?.toString() ?? '0',
      expenseCount: total._count.id,
      breakdown: categoryBreakdown.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId ? (categoryMap.get(c.categoryId) ?? 'Uncategorized') : 'Uncategorized',
        total: c._sum.amount?.toString() ?? '0',
        count: c._count.id,
      })),
    };
  },
};
