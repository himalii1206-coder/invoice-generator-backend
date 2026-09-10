import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import prisma from '@/lib/db';
import { parsePaginationQuery, successResponse, createdResponse } from '@/lib/api-response';
import { createStockAdjustmentSchema } from '@/validations/expense.validation';
import { NotFoundError } from '@/middleware/error.middleware';
import Decimal from 'decimal.js';

const router = Router();

router.use(authenticate);

// GET /api/inventory/movements — List stock movements
router.get('/movements', authorizeCompany(), async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const companyId = req.companyId!;
  const productId = req.query.productId as string;
  const type = req.query.type as string;

  const where: any = { companyId };
  if (productId) where.productId = productId;
  if (type) where.type = type;

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return successResponse(res, {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }, 'Stock movements retrieved');
});

// POST /api/inventory/adjust — Manual stock adjustment (IN, OUT, CORRECTION)
router.post('/adjust', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const validated = createStockAdjustmentSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: validated.productId, companyId },
    });
    if (!product) throw new NotFoundError('Product not found');

    const previousStock = new Decimal(product.currentStock.toString());
    const adjustmentQty = new Decimal(validated.quantity.toString());
    let newStock = previousStock;

    if (validated.type === 'IN' || validated.type === 'ADD') {
      newStock = previousStock.plus(adjustmentQty);
    } else if (validated.type === 'OUT' || validated.type === 'SUBTRACT') {
      newStock = Decimal.max(0, previousStock.minus(adjustmentQty));
    } else if (validated.type === 'CORRECTION' || validated.type === 'SET') {
      newStock = adjustmentQty;
    }

    // Update product stock
    await tx.product.update({
      where: { id: validated.productId },
      data: { currentStock: newStock.toString() },
    });

    // Record movement audit
    const movement = await tx.stockMovement.create({
      data: {
        companyId,
        productId: validated.productId,
        type: (validated.type === 'IN' || validated.type === 'ADD') ? 'PURCHASE' : (validated.type === 'OUT' || validated.type === 'SUBTRACT') ? 'DAMAGE' : 'ADJUSTMENT',
        quantity: (validated.type === 'OUT' || validated.type === 'SUBTRACT') ? adjustmentQty.negated().toString() : adjustmentQty.toString(),
        balanceBefore: previousStock.toString(),
        balanceAfter: newStock.toString(),
        notes: `${validated.reason || 'Stock Adjustment'}: ${validated.notes || ''}`,
      },
      include: { product: true },
    });

    return movement;
  });

  return createdResponse(res, result, 'Stock adjustment completed successfully');
});

export default router;
