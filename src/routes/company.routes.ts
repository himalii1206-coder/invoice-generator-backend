import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import { companyService } from '@/services/company.service';
import { successResponse, createdResponse } from '@/lib/api-response';
import { createCompanySchema, updateCompanySchema } from '@/validations/company.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all companies for current user
router.get('/', async (req: Request, res: Response) => {
  const companies = await companyService.getUserCompanies(req.userId!);
  return successResponse(res, companies, 'Companies retrieved');
});

// Create a new company
router.post('/', async (req: Request, res: Response) => {
  const data = createCompanySchema.parse(req.body);
  const company = await companyService.createCompany(req.userId!, data);
  return createdResponse(res, company, 'Company created successfully');
});

// Get specific company (user must be member)
router.get('/:companyId', async (req: Request, res: Response) => {
  const company = await companyService.getCompanyById(req.params.companyId, req.userId!);
  return successResponse(res, company, 'Company details retrieved');
});

// Update company — requires company membership and company header
router.patch('/:companyId', authorizeCompany(), async (req: Request, res: Response) => {
  const data = updateCompanySchema.parse(req.body);
  const company = await companyService.updateCompany(req.companyId!, data);
  return successResponse(res, company, 'Company updated');
});

// Get company members
router.get('/:companyId/members', authorizeCompany(), async (req: Request, res: Response) => {
  const members = await companyService.getMembers(req.companyId!);
  return successResponse(res, members, 'Members retrieved');
});

// Invite member
router.post('/:companyId/members', authorizeCompany('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  const { email, roleId } = req.body;
  const member = await companyService.inviteMember(req.companyId!, email, roleId);
  return createdResponse(res, member, 'Member invited successfully');
});

// Remove member
router.delete('/:companyId/members/:memberId', authorizeCompany('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  await companyService.removeMember(req.companyId!, req.params.memberId);
  return successResponse(res, null, 'Member removed');
});

export default router;
