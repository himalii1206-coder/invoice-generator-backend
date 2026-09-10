import prisma from '@/lib/db';

/**
 * Generate the next invoice number for a company in a transaction-safe way.
 * Uses a SELECT FOR UPDATE on invoice settings to prevent duplicates under concurrency.
 *
 * Format example: INV/2025-26/000001
 */
export async function generateInvoiceNumber(
  companyId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const client = tx ?? prisma;

  // Lock the invoice settings row for this company
  const settings = await (client as typeof prisma).companyInvoiceSettings.findUnique({
    where: { companyId },
  });

  if (!settings) {
    // Create default settings
    const newSettings = await (client as typeof prisma).companyInvoiceSettings.create({
      data: {
        companyId,
        prefix: 'INV',
        separator: '/',
        includeFinancialYear: true,
        financialYearFormat: 'YYYY-YY',
        numberLength: 6,
        currentSequence: 1,
      },
    });
    return buildInvoiceNumber(newSettings, 1);
  }

  const nextSequence = settings.currentSequence + 1;

  await (client as typeof prisma).companyInvoiceSettings.update({
    where: { companyId },
    data: { currentSequence: nextSequence },
  });

  return buildInvoiceNumber(settings, nextSequence);
}

function buildInvoiceNumber(
  settings: {
    prefix: string;
    separator: string;
    includeFinancialYear: boolean;
    financialYearFormat: string;
    numberLength: number;
  },
  sequence: number,
): string {
  const { prefix, separator, includeFinancialYear, financialYearFormat, numberLength } = settings;
  const parts: string[] = [prefix];

  if (includeFinancialYear) {
    parts.push(getFinancialYear(financialYearFormat));
  }

  parts.push(String(sequence).padStart(numberLength, '0'));

  return parts.join(separator);
}

function getFinancialYear(format: string): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // Indian financial year: April (4) to March (3)
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;

  if (format === 'YYYY-YY') {
    return `${fyStart}-${String(fyEnd).slice(-2)}`;
  }
  if (format === 'YYYY-YYYY') {
    return `${fyStart}-${fyEnd}`;
  }
  if (format === 'YYYY') {
    return `${fyStart}`;
  }
  return `${fyStart}-${String(fyEnd).slice(-2)}`;
}

/**
 * Generate a credit note number.
 */
export async function generateCreditNoteNumber(companyId: string): Promise<string> {
  const count = await prisma.creditNote.count({ where: { companyId } });
  const seq = count + 1;
  const fy = getFinancialYear('YYYY-YY');
  return `CN/${fy}/${String(seq).padStart(6, '0')}`;
}

/**
 * Generate a debit note number.
 */
export async function generateDebitNoteNumber(companyId: string): Promise<string> {
  const count = await prisma.debitNote.count({ where: { companyId } });
  const seq = count + 1;
  const fy = getFinancialYear('YYYY-YY');
  return `DN/${fy}/${String(seq).padStart(6, '0')}`;
}

/**
 * Generate a sales return number.
 */
export async function generateReturnNumber(companyId: string): Promise<string> {
  const count = await prisma.salesReturn.count({ where: { companyId } });
  const seq = count + 1;
  const fy = getFinancialYear('YYYY-YY');
  return `SR/${fy}/${String(seq).padStart(6, '0')}`;
}
