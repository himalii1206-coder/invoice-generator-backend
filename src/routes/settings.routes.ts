import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authorizeCompany } from '@/middleware/auth.middleware';
import prisma from '@/lib/db';
import { successResponse } from '@/lib/api-response';
import { NotFoundError } from '@/middleware/error.middleware';

const router = Router();

router.use(authenticate);

// GET /api/settings/company — Get company settings & configuration
router.get('/company', authorizeCompany(), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const [company, settings, invoiceSettings, bankAccounts] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.companySettings.findUnique({ where: { companyId } }),
    prisma.companyInvoiceSettings.findUnique({ where: { companyId } }),
    prisma.companyBankAccount.findMany({ where: { companyId } }),
  ]);

  if (!company) throw new NotFoundError('Company not found');

  return successResponse(
    res,
    { company, settings, invoiceSettings, bankAccounts },
    'Company settings retrieved'
  );
});

// PATCH /api/settings/company — Update settings
router.patch('/company', authorizeCompany('OWNER', 'ADMIN'), async (req: Request, res: Response) => {
  const companyId = req.companyId!;
  const { companyData, settingsData, invoiceSettingsData } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    let updatedCompany;
    if (companyData) {
      updatedCompany = await tx.company.update({
        where: { id: companyId },
        data: companyData,
      });
    }

    let updatedSettings;
    if (settingsData) {
      updatedSettings = await tx.companySettings.upsert({
        where: { companyId },
        update: settingsData,
        create: {
          companyId,
          ...settingsData,
        },
      });
    }

    let updatedInvoiceSettings;
    if (invoiceSettingsData) {
      updatedInvoiceSettings = await tx.companyInvoiceSettings.upsert({
        where: { companyId },
        update: invoiceSettingsData,
        create: {
          companyId,
          ...invoiceSettingsData,
        },
      });
    }

    return { company: updatedCompany, settings: updatedSettings, invoiceSettings: updatedInvoiceSettings };
  });

  return successResponse(res, result, 'Settings updated successfully');
});

export default router;
