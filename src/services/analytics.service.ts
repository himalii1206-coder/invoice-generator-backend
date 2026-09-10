import prisma from '@/lib/db';
import { parsePaginationQuery } from '@/lib/api-response';

export const analyticsService = {
  async getDashboardKpis(companyId: string, userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all KPI queries in parallel
    const [
      totalSalesAgg,
      todaySalesAgg,
      monthSalesAgg,
      invoiceCounts,
      overdueAgg,
      expensesAgg,
      gstAgg,
      outstandingAgg,
    ] = await Promise.all([
      // Total sales (all paid/partially paid invoices)
      prisma.invoice.aggregate({
        where: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        _sum: { grandTotal: true, paidAmount: true },
      }),
      // Today's sales
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          invoiceDate: { gte: todayStart },
        },
        _sum: { grandTotal: true },
      }),
      // This month's sales
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          invoiceDate: { gte: monthStart },
        },
        _sum: { grandTotal: true },
      }),
      // Invoice status counts
      prisma.invoice.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      // Overdue amount
      prisma.invoice.aggregate({
        where: { companyId, status: 'OVERDUE' },
        _sum: { outstandingAmount: true },
      }),
      // Total expenses this month
      prisma.expense.aggregate({
        where: { companyId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // GST collected
      prisma.invoice.aggregate({
        where: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true },
      }),
      // Outstanding amount
      prisma.invoice.aggregate({
        where: { companyId, status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { outstandingAmount: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    invoiceCounts.forEach((c) => { statusMap[c.status] = c._count.id; });

    const totalSales = totalSalesAgg._sum.grandTotal?.toString() ?? '0';
    const totalExpenses = expensesAgg._sum.amount?.toString() ?? '0';

    const gstCollected = [
      gstAgg._sum.cgstAmount,
      gstAgg._sum.sgstAmount,
      gstAgg._sum.igstAmount,
      gstAgg._sum.cessAmount,
    ]
      .reduce((acc, v) => acc + parseFloat(v?.toString() ?? '0'), 0)
      .toFixed(2);

    return {
      totalSales,
      todaySales: todaySalesAgg._sum.grandTotal?.toString() ?? '0',
      thisMonthSales: monthSalesAgg._sum.grandTotal?.toString() ?? '0',
      totalInvoices: Object.values(statusMap).reduce((a, b) => a + b, 0),
      paidInvoices: statusMap['PAID'] ?? 0,
      unpaidInvoices: (statusMap['ISSUED'] ?? 0) + (statusMap['SENT'] ?? 0),
      overdueInvoices: statusMap['OVERDUE'] ?? 0,
      overdueAmount: overdueAgg._sum.outstandingAmount?.toString() ?? '0',
      totalExpenses,
      netRevenue: (parseFloat(totalSales) - parseFloat(totalExpenses)).toFixed(2),
      gstCollected,
      outstandingAmount: outstandingAgg._sum.outstandingAmount?.toString() ?? '0',
      invoiceStatusCounts: statusMap,
    };
  },

  async getSalesTrend(companyId: string, days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const invoices = await prisma.$queryRaw<{ date: string; total: number; count: number }[]>`
      SELECT 
        DATE("invoiceDate") as date,
        SUM("grandTotal")::float as total,
        COUNT(id)::int as count
      FROM invoices
      WHERE "companyId" = ${companyId}
        AND "invoiceDate" >= ${fromDate}
        AND status NOT IN ('DRAFT', 'CANCELLED')
      GROUP BY DATE("invoiceDate")
      ORDER BY date ASC
    `;

    return invoices;
  },

  async getTopProducts(companyId: string, limit = 10) {
    const topProducts = await prisma.invoiceItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        invoice: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        productId: { not: null },
      },
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });

    return topProducts.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      quantitySold: p._sum.quantity?.toString() ?? '0',
      revenue: p._sum.totalAmount?.toString() ?? '0',
    }));
  },

  async getTopCustomers(companyId: string, limit = 10) {
    const topCustomers = await prisma.invoice.groupBy({
      by: ['customerId', 'customerName'],
      where: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      _sum: { grandTotal: true, outstandingAmount: true },
      _count: { id: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: limit,
    });

    return topCustomers.map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      totalPurchases: c._sum.grandTotal?.toString() ?? '0',
      outstandingAmount: c._sum.outstandingAmount?.toString() ?? '0',
      invoiceCount: c._count.id,
    }));
  },

  async getPaymentMethodBreakdown(companyId: string) {
    const breakdown = await prisma.payment.groupBy({
      by: ['method'],
      where: { companyId },
      _sum: { amount: true },
      _count: { id: true },
    });

    return breakdown.map((b) => ({
      method: b.method,
      total: b._sum.amount?.toString() ?? '0',
      count: b._count.id,
    }));
  },

  async getExpenseTrend(companyId: string, days = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const expenses = await prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT 
        DATE(date) as date,
        SUM(amount)::float as total
      FROM expenses
      WHERE "companyId" = ${companyId}
        AND date >= ${fromDate}
      GROUP BY DATE(date)
      ORDER BY date ASC
    `;

    return expenses;
  },

  async getInsights(companyId: string) {
    const insights: Array<{ type: string; message: string; severity: string }> = [];

    const [
      lastMonthSales,
      thisMonthSales,
      overdueInvoices,
      lowStockProducts,
      topPaymentMethod,
      topCustomerOutstanding,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          invoiceDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: {
          companyId,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          invoiceDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.count({ where: { companyId, status: 'OVERDUE' } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int FROM products
        WHERE "companyId" = ${companyId}
          AND "isStockTracked" = true
          AND "isActive" = true
          AND "currentStock" <= "minStockLevel"
      `,
      prisma.payment.groupBy({
        by: ['method'],
        where: { companyId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
      prisma.invoice.findFirst({
        where: { companyId, status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        orderBy: { outstandingAmount: 'desc' },
        select: { customerName: true, outstandingAmount: true },
      }),
    ]);

    // Sales comparison
    const lastMonthTotal = parseFloat(lastMonthSales._sum.grandTotal?.toString() ?? '0');
    const thisMonthTotal = parseFloat(thisMonthSales._sum.grandTotal?.toString() ?? '0');
    if (lastMonthTotal > 0) {
      const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      if (change > 0) {
        insights.push({
          type: 'sales_up',
          message: `Sales increased by ${change.toFixed(1)}% compared to last month.`,
          severity: 'success',
        });
      } else if (change < -10) {
        insights.push({
          type: 'sales_down',
          message: `Sales dropped by ${Math.abs(change).toFixed(1)}% compared to last month.`,
          severity: 'warning',
        });
      }
    }

    if (overdueInvoices > 0) {
      insights.push({
        type: 'overdue',
        message: `${overdueInvoices} invoice${overdueInvoices > 1 ? 's are' : ' is'} overdue.`,
        severity: 'error',
      });
    }

    const lowStockCount = lowStockProducts[0]?.count ?? 0;
    if (lowStockCount > 0) {
      insights.push({
        type: 'low_stock',
        message: `${lowStockCount} product${lowStockCount > 1 ? 's are' : ' is'} below minimum stock level.`,
        severity: 'warning',
      });
    }

    if (topPaymentMethod.length > 0) {
      insights.push({
        type: 'payment_method',
        message: `${topPaymentMethod[0].method.replace('_', ' ')} is your most-used payment method.`,
        severity: 'info',
      });
    }

    if (topCustomerOutstanding) {
      const amt = parseFloat(topCustomerOutstanding.outstandingAmount.toString());
      if (amt > 0) {
        insights.push({
          type: 'customer_outstanding',
          message: `${topCustomerOutstanding.customerName} has ₹${amt.toLocaleString('en-IN')} outstanding.`,
          severity: 'warning',
        });
      }
    }

    return insights;
  },
};
