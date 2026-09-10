import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { customerService } from '@/services/customer.service';
import { successResponse, createdResponse } from '@/lib/api-response';
import { createCustomerSchema, updateCustomerSchema } from '@/validations/customer.validation';

const router = Router();

router.use(authenticate);

// GET /api/customers — List customers for active company
router.get('/', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const search = req.query.search as string;
  const type = req.query.type as string;
  const result = await customerService.getCustomers(companyId, req.query, search, type);
  return successResponse(res, result, 'Customers retrieved successfully');
});

// GET /api/customers/:id — Get customer by ID
router.get('/:id', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const customer = await customerService.getCustomerById(companyId, req.params.id);
  return successResponse(res, customer, 'Customer retrieved successfully');
});

// POST /api/customers — Create new customer
router.post('/', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT', 'SALES_MANAGER'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const validated = createCustomerSchema.parse(req.body);
  const customer = await customerService.createCustomer(companyId, validated, req.userId);
  return createdResponse(res, customer, 'Customer created successfully');
});

// PATCH /api/customers/:id — Update customer
router.patch('/:id', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT', 'SALES_MANAGER'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const validated = updateCustomerSchema.parse(req.body);
  const customer = await customerService.updateCustomer(companyId, req.params.id, validated, req.userId);
  return successResponse(res, customer, 'Customer updated successfully');
});

// DELETE /api/customers/:id — Soft delete customer
router.delete('/:id', authorizeCompany('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const result = await customerService.deleteCustomer(companyId, req.params.id, req.userId);
  return successResponse(res, result, 'Customer deleted successfully');
});

export default router;
