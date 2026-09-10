import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { reportService } from '@/services/report.service';
import { successResponse } from '@/lib/api-response';

const router = Router();

router.use(authenticate);

// GET /api/reports/sales — Sales report
router.get('/sales', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const report = await reportService.getSalesReport(companyId, {
    fromDate: req.query.fromDate as string,
    toDate: req.query.toDate as string,
    customerId: req.query.customerId as string,
  });
  return successResponse(res, report, 'Sales report generated');
});

// GET /api/reports/gst — GST GSTR-1 / GSTR-3B summary report
router.get('/gst', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const report = await reportService.getGstReport(companyId, {
    fromDate: req.query.fromDate as string,
    toDate: req.query.toDate as string,
  });
  return successResponse(res, report, 'GST report generated');
});

// GET /api/reports/payments — Payment report
router.get('/payments', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const report = await reportService.getPaymentReport(companyId, {
    fromDate: req.query.fromDate as string,
    toDate: req.query.toDate as string,
  });
  return successResponse(res, report, 'Payment report generated');
});

// GET /api/reports/expenses — Expense summary report
router.get('/expenses', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const report = await reportService.getExpenseReport(companyId, {
    fromDate: req.query.fromDate as string,
    toDate: req.query.toDate as string,
  });
  return successResponse(res, report, 'Expense report generated');
});

export default router;
