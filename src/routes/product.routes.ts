import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany, requirePermission } from '@/middleware/auth.middleware';
import { productService } from '@/services/product.service';
import { successResponse, createdResponse } from '@/lib/api-response';
import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  createUnitSchema,
  createTaxRateSchema,
} from '@/validations/product.validation';
import { PERMISSIONS } from '@/types';

const router = Router();

router.use(authenticate);
router.use(authorizeCompany());

// --- CATEGORIES ---
router.get('/categories', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const categories = await productService.listCategories(req.companyId!);
  return successResponse(res, categories, 'Categories retrieved');
});

router.post('/categories', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const validated = createCategorySchema.parse(req.body);
  const category = await productService.createCategory(req.companyId!, validated.name, validated.description);
  return createdResponse(res, category, 'Category created');
});

// --- UNITS ---
router.get('/units', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const units = await productService.listUnits(req.companyId!);
  return successResponse(res, units, 'Units retrieved');
});

router.post('/units', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const validated = createUnitSchema.parse(req.body);
  const unit = await productService.createUnit(req.companyId!, validated.name, validated.shortName);
  return createdResponse(res, unit, 'Unit created');
});

// --- TAX RATES ---
router.get('/tax-rates', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const rates = await productService.listTaxRates(req.companyId!);
  return successResponse(res, rates, 'Tax rates retrieved');
});

router.post('/tax-rates', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const validated = createTaxRateSchema.parse(req.body);
  const rate = await productService.createTaxRate(req.companyId!, validated as any);
  return createdResponse(res, rate, 'Tax rate created');
});

// --- PRODUCTS ---
router.get('/', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const result = await productService.list(req.companyId!, req.query as Record<string, unknown>);
  return successResponse(res, result.data, 'Products retrieved successfully', {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
});

router.get('/low-stock', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const products = await productService.getLowStockProducts(req.companyId!);
  return successResponse(res, products, 'Low stock products retrieved');
});

router.get('/:id', requirePermission(PERMISSIONS.VIEW_PRODUCTS), async (req: Request, res: Response) => {
  const product = await productService.getById(req.companyId!, req.params.id);
  return successResponse(res, product, 'Product retrieved');
});

router.post('/', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const validated = createProductSchema.parse(req.body);
  const product = await productService.create(req.companyId!, validated);
  return createdResponse(res, product, 'Product created successfully');
});

router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const validated = updateProductSchema.parse(req.body);
  const product = await productService.update(req.companyId!, req.params.id, validated);
  return successResponse(res, product, 'Product updated successfully');
});

router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_PRODUCTS), async (req: Request, res: Response) => {
  const result = await productService.archive(req.companyId!, req.params.id);
  return successResponse(res, result, 'Product archived successfully');
});

export default router;
