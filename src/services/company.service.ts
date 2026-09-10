import prisma from '@/lib/db';
import { ConflictError, NotFoundError } from '@/middleware/error.middleware';
import { ROLE_PERMISSIONS } from '@/types';
import type { createCompanySchema, updateCompanySchema } from '@/validations/company.validation';
import type { z } from 'zod';

export const companyService = {
  async createCompany(userId: string, data: z.infer<typeof createCompanySchema>) {
    // Get the OWNER role
    const ownerRole = await prisma.role.findUnique({ where: { name: 'OWNER' } });
    if (!ownerRole) throw new Error('Owner role not found. Run seed first.');

    const company = await prisma.$transaction(async (tx) => {
      // Create company
      const c = await tx.company.create({ data });

      // Make creator an owner member
      await tx.companyMember.create({
        data: {
          companyId: c.id,
          userId,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });

      // Create default company settings
      await tx.companySettings.create({
        data: { companyId: c.id },
      });

      // Create default invoice settings
      await tx.companyInvoiceSettings.create({
        data: { companyId: c.id },
      });

      // Create default GST tax rates
      const taxRates = [
        { name: 'Exempt (0%)', rate: '0', cgst: '0', sgst: '0', igst: '0', cess: '0' },
        { name: 'GST 5%', rate: '5', cgst: '2.5', sgst: '2.5', igst: '5', cess: '0' },
        { name: 'GST 12%', rate: '12', cgst: '6', sgst: '6', igst: '12', cess: '0' },
        { name: 'GST 18%', rate: '18', cgst: '9', sgst: '9', igst: '18', cess: '0', isDefault: true },
        { name: 'GST 28%', rate: '28', cgst: '14', sgst: '14', igst: '28', cess: '0' },
      ];

      for (const tr of taxRates) {
        await tx.taxRate.create({
          data: { companyId: c.id, ...tr, isDefault: tr.isDefault ?? false },
        });
      }

      // Create default units
      const units = [
        { name: 'Pieces', shortName: 'PCS' },
        { name: 'Kilograms', shortName: 'KG' },
        { name: 'Litres', shortName: 'LTR' },
        { name: 'Metres', shortName: 'MTR' },
        { name: 'Hours', shortName: 'HRS' },
        { name: 'Numbers', shortName: 'NOS' },
      ];

      for (const u of units) {
        await tx.unit.create({ data: { companyId: c.id, ...u } });
      }

      // Create default expense categories
      const expenseCategories = [
        'Rent', 'Salary', 'Utilities', 'Marketing', 'Travel',
        'Office Supplies', 'Software', 'Maintenance', 'Other',
      ];
      for (const name of expenseCategories) {
        await tx.expenseCategory.create({ data: { companyId: c.id, name } });
      }

      return c;
    });

    return company;
  },

  async getUserCompanies(userId: string) {
    const members = await prisma.companyMember.findMany({
      where: { userId, isActive: true },
      include: {
        company: {
          select: {
            id: true,
            displayName: true,
            legalName: true,
            logoUrl: true,
            gstin: true,
            state: true,
            isActive: true,
          },
        },
        role: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      ...m.company,
      role: m.role,
      isOwner: m.isOwner,
    }));
  },

  async getCompanyById(companyId: string, userId: string) {
    const member = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!member) throw new NotFoundError('Company');

    return prisma.company.findUnique({
      where: { id: companyId },
      include: {
        settings: true,
        invoiceSettings: true,
        bankAccounts: true,
        taxSettings: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
        _count: {
          select: { customers: true, products: true, invoices: true },
        },
      },
    });
  },

  async updateCompany(companyId: string, data: z.infer<typeof updateCompanySchema>) {
    return prisma.company.update({
      where: { id: companyId },
      data,
    });
  },

  async getMembers(companyId: string) {
    return prisma.companyMember.findMany({
      where: { companyId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: true,
      },
    });
  },

  async inviteMember(companyId: string, email: string, roleId: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('User with this email');

    const existing = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });

    if (existing) throw new ConflictError('User is already a member of this company');

    return prisma.companyMember.create({
      data: { companyId, userId: user.id, roleId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: true,
      },
    });
  },

  async removeMember(companyId: string, memberId: string) {
    const member = await prisma.companyMember.findFirst({
      where: { id: memberId, companyId, isOwner: false },
    });

    if (!member) throw new NotFoundError('Member');

    return prisma.companyMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });
  },
};
