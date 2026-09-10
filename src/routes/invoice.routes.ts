import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { invoiceService } from '@/services/invoice.service';
import { successResponse, createdResponse } from '@/lib/api-response';
import { createInvoiceSchema, recordPaymentSchema } from '@/validations/invoice.validation';

const router = Router();

router.use(authenticate);

// GET /api/invoices — List invoices with filters
router.get('/', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const result = await invoiceService.list(companyId, req.query as Record<string, unknown>);
  return successResponse(res, result.data, 'Invoices retrieved successfully', {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
});

// GET /api/invoices/:id — Get invoice by ID
router.get('/:id', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const invoice = await invoiceService.getById(companyId, req.params.id);
  return successResponse(res, invoice, 'Invoice retrieved successfully');
});

// POST /api/invoices — Create new invoice
router.post('/', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT', 'SALES_MANAGER', 'SALES_STAFF'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const validated = createInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.create(companyId, req.userId!, validated as any);
  return createdResponse(res, invoice, 'Invoice created successfully');
});

// POST /api/invoices/:id/payments — Record payment on invoice
router.post('/:id/payments', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT', 'SALES_MANAGER'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const validated = recordPaymentSchema.parse(req.body);
  const payment = await invoiceService.recordPayment(companyId, req.params.id, req.userId!, validated as any);
  return createdResponse(res, payment, 'Payment recorded successfully');
});

// POST /api/invoices/:id/cancel — Cancel invoice
router.post('/:id/cancel', authorizeCompany('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const reason = req.body.reason || 'Invoice cancelled by user';
  const invoice = await invoiceService.cancelInvoice(companyId, req.params.id, req.userId!, reason);
  return successResponse(res, invoice, 'Invoice cancelled successfully');
});

export default router;
