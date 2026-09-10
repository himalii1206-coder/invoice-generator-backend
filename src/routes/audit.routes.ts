import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { auditService } from '@/services/audit.service';
import { successResponse } from '@/lib/api-response';

const router = Router();

router.use(authenticate);

// GET /api/audit-logs — Retrieve audit logs for company
router.get('/', authorizeCompany('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const action = req.query.action as string;
  const entity = req.query.entity as string;

  const result = await auditService.getLogs(companyId, req.query, action, entity);
  return successResponse(res, result, 'Audit logs retrieved');
});

export default router;
