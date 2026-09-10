import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import prisma from '@/lib/db';
import { parsePaginationQuery, successResponse, createdResponse } from '@/lib/api-response';
import { createExpenseSchema } from '@/validations/expense.validation';
import { NotFoundError } from '@/middleware/error.middleware';

const router = Router();

router.use(authenticate);

// GET /api/expenses/categories — Get expense categories
router.get('/categories', authorizeCompany(), async (req: Request, res: Response) => {
  const categories = await prisma.expenseCategory.findMany({
    where: { companyId: req.companyId! },
    orderBy: { name: 'asc' },
  });
  return successResponse(res, categories, 'Categories retrieved');
});

// POST /api/expenses/categories — Create category
router.post('/categories', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  const category = await prisma.expenseCategory.create({
    data: {
      companyId: req.companyId!,
      name: req.body.name,
    },
  });
  return createdResponse(res, category, 'Expense category created');
});

// GET /api/expenses — List expenses
router.get('/', authorizeCompany(), async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const companyId = req.companyId!;
  const categoryId = req.query.categoryId as string;
  const search = req.query.search as string;

  const where: any = { companyId };
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      include: { category: true },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  return successResponse(res, {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }, 'Expenses retrieved');
});

// POST /api/expenses — Create expense
router.post('/', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  const validated = createExpenseSchema.parse(req.body);
  const expense = await prisma.expense.create({
    data: {
      companyId: req.companyId!,
      categoryId: validated.categoryId,
      amount: validated.amount,
      date: new Date(validated.date),
      method: validated.method as any,
      vendor: validated.payeeName,
      description: validated.notes,
      notes: validated.notes,
    },
    include: { category: true },
  });
  return createdResponse(res, expense, 'Expense created successfully');
});

// DELETE /api/expenses/:id — Delete expense
router.delete('/:id', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, companyId: req.companyId! },
  });
  if (!existing) throw new NotFoundError('Expense not found');

  await prisma.expense.delete({ where: { id: req.params.id } });
  return successResponse(res, { id: req.params.id }, 'Expense deleted successfully');
});

export default router;
