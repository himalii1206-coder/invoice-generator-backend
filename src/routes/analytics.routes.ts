import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { analyticsService } from '@/services/analytics.service';
import { successResponse } from '@/lib/api-response';

const router = Router();

router.use(authenticate);

// GET /api/analytics/dashboard — Real database aggregated KPIs & charts
router.get('/dashboard', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const kpis = await analyticsService.getDashboardKpis(companyId, req.userId!);
  return successResponse(res, kpis, 'Dashboard KPIs retrieved successfully');
});

// GET /api/analytics/insights — Auto-generated business insights
router.get('/insights', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const insights = await analyticsService.getInsights(companyId);
  return successResponse(res, insights, 'Business insights retrieved successfully');
});

export default router;
