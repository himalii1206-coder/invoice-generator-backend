import prisma from '@/lib/db';
import { NotFoundError } from '@/middleware/error.middleware';
import { parsePaginationQuery } from '@/lib/api-response';
import type { createProductSchema, updateProductSchema } from '@/validations/product.validation';
import type { z } from 'zod';

export const productService = {
  async list(companyId: string, query: Record<string, unknown>) {
    const { page, limit, search, sortBy, sortOrder, skip } = parsePaginationQuery(query);
    const categoryId = typeof query.categoryId === 'string' ? query.categoryId : undefined;
    const type = typeof query.type === 'string' ? query.type : undefined;
    const lowStock = query.lowStock === 'true';

    const where = {
      companyId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { hsn: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(lowStock && {
        isStockTracked: true,
        currentStock: { lte: prisma.product.fields.minStockLevel },
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortName: true } },
          taxRate: { select: { id: true, name: true, rate: true, cgst: true, sgst: true, igst: true } },
        },
        orderBy: { [sortBy ?? 'name']: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { data: products, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(companyId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
      include: {
        category: true,
        unit: true,
        taxRate: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!product) throw new NotFoundError('Product');
    return product;
  },

  async create(companyId: string, data: z.infer<typeof createProductSchema>) {
    const product = await prisma.product.create({
      data: {
        ...data,
        companyId,
        currentStock: data.openingStock ?? '0',
      },
      include: { category: true, unit: true, taxRate: true },
    });

    // Create opening stock movement if stock > 0
    if (parseFloat(data.openingStock ?? '0') > 0) {
      await prisma.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          type: 'OPENING',
          quantity: data.openingStock ?? '0',
          balanceBefore: '0',
          balanceAfter: data.openingStock ?? '0',
          notes: 'Opening stock',
        },
      });
    }

    return product;
  },

  async update(companyId: string, productId: string, data: z.infer<typeof updateProductSchema>) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) throw new NotFoundError('Product');

    return prisma.product.update({
      where: { id: productId },
      data,
      include: { category: true, unit: true, taxRate: true },
    });
  },

  async archive(companyId: string, productId: string) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) throw new NotFoundError('Product');

    return prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  },

  async getLowStockProducts(companyId: string) {
    const products = await prisma.$queryRaw<{ id: string; name: string; sku: string; currentStock: number; minStockLevel: number }[]>`
      SELECT id, name, sku, "currentStock", "minStockLevel"
      FROM products
      WHERE "companyId" = ${companyId}
        AND "isStockTracked" = true
        AND "isActive" = true
        AND "currentStock" <= "minStockLevel"
      ORDER BY "currentStock" ASC
      LIMIT 20
    `;
    return products;
  },

  // Categories
  async listCategories(companyId: string) {
    return prisma.productCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },

  async createCategory(companyId: string, name: string, description?: string) {
    return prisma.productCategory.create({
      data: { companyId, name, description },
    });
  },

  // Units
  async listUnits(companyId: string) {
    return prisma.unit.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  },

  async createUnit(companyId: string, name: string, shortName: string) {
    return prisma.unit.create({ data: { companyId, name, shortName } });
  },

  // Tax rates
  async listTaxRates(companyId: string) {
    return prisma.taxRate.findMany({
      where: { companyId, isActive: true },
      orderBy: { rate: 'asc' },
    });
  },

  async createTaxRate(companyId: string, data: Record<string, string | boolean>) {
    return prisma.taxRate.create({ data: { companyId, ...data } as Parameters<typeof prisma.taxRate.create>[0]['data'] });
  },
};
