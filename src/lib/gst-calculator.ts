import Decimal from 'decimal.js';
import type {
  GstBreakdown,
  InvoiceCalculation,
  InvoiceItemCalculation,
  InvoiceItemInput,
  TaxBreakdownEntry,
  TaxType,
} from '@/types';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================
// Core GST Calculation Engine
// All calculations use Decimal.js — never floating point
// ============================================================

/**
 * Calculate GST breakdown for a single taxable amount.
 * Determines CGST+SGST vs IGST based on intra/inter-state.
 */
export function calculateItemGst(params: {
  taxableAmount: Decimal;
  totalRate: Decimal; // e.g. 18 for 18%
  cessRate: Decimal;
  isInterState: boolean;
}): GstBreakdown {
  const { taxableAmount, totalRate, cessRate, isInterState } = params;

  let cgstRate = new Decimal(0);
  let sgstRate = new Decimal(0);
  let igstRate = new Decimal(0);

  if (isInterState) {
    igstRate = totalRate;
  } else {
    cgstRate = totalRate.div(2).toDecimalPlaces(2);
    sgstRate = totalRate.div(2).toDecimalPlaces(2);
  }

  const cgstAmount = taxableAmount.mul(cgstRate).div(100).toDecimalPlaces(2);
  const sgstAmount = taxableAmount.mul(sgstRate).div(100).toDecimalPlaces(2);
  const igstAmount = taxableAmount.mul(igstRate).div(100).toDecimalPlaces(2);
  const cessAmount = taxableAmount.mul(cessRate).div(100).toDecimalPlaces(2);

  const totalTax = cgstAmount.plus(sgstAmount).plus(igstAmount).plus(cessAmount);

  return {
    taxableAmount: taxableAmount.toFixed(2),
    cgstRate: cgstRate.toFixed(2),
    cgstAmount: cgstAmount.toFixed(2),
    sgstRate: sgstRate.toFixed(2),
    sgstAmount: sgstAmount.toFixed(2),
    igstRate: igstRate.toFixed(2),
    igstAmount: igstAmount.toFixed(2),
    cessRate: cessRate.toFixed(2),
    cessAmount: cessAmount.toFixed(2),
    totalTax: totalTax.toFixed(2),
  };
}

/**
 * Calculate a single invoice item's financial values.
 */
export function calculateInvoiceItem(
  item: InvoiceItemInput,
  isInterState: boolean,
): InvoiceItemCalculation {
  const quantity = new Decimal(item.quantity || '0');
  const rate = new Decimal(item.rate || '0');
  const lineTotal = quantity.mul(rate);

  // Discount
  let discountAmount = new Decimal(0);
  if (item.discountType === 'PERCENTAGE' && item.discountValue) {
    discountAmount = lineTotal
      .mul(new Decimal(item.discountValue))
      .div(100)
      .toDecimalPlaces(2);
  } else if (item.discountType === 'FIXED' && item.discountValue) {
    discountAmount = new Decimal(item.discountValue).toDecimalPlaces(2);
  }

  const taxableAmount = lineTotal.minus(discountAmount).toDecimalPlaces(2);

  // Tax rates from item (already snapshotted from TaxRate)
  const totalTaxRate = new Decimal(item.taxRate || '0');
  const cessRate = new Decimal(item.cessRate || '0');

  const gst = calculateItemGst({
    taxableAmount,
    totalRate: totalTaxRate,
    cessRate,
    isInterState,
  });

  const totalAmount = taxableAmount
    .plus(new Decimal(gst.cgstAmount))
    .plus(new Decimal(gst.sgstAmount))
    .plus(new Decimal(gst.igstAmount))
    .plus(new Decimal(gst.cessAmount))
    .toDecimalPlaces(2);

  return {
    quantity: quantity.toFixed(2),
    rate: rate.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    taxableAmount: gst.taxableAmount,
    cgstRate: gst.cgstRate,
    cgstAmount: gst.cgstAmount,
    sgstRate: gst.sgstRate,
    sgstAmount: gst.sgstAmount,
    igstRate: gst.igstRate,
    igstAmount: gst.igstAmount,
    cessRate: gst.cessRate,
    cessAmount: gst.cessAmount,
    totalAmount: totalAmount.toFixed(2),
  };
}

/**
 * Calculate the full invoice totals including all items, discounts,
 * GST breakdown, and round-off.
 */
export function calculateInvoiceTotals(params: {
  items: InvoiceItemInput[];
  isInterState: boolean;
  invoiceDiscountType?: 'PERCENTAGE' | 'FIXED';
  invoiceDiscountValue?: string;
  otherCharges?: string;
  shippingCharges?: string;
  roundOff?: boolean;
}): InvoiceCalculation {
  const {
    items,
    isInterState,
    invoiceDiscountType,
    invoiceDiscountValue,
    otherCharges = '0',
    shippingCharges = '0',
    roundOff = true,
  } = params;

  // Calculate each item
  const itemCalculations = items.map((item) =>
    calculateInvoiceItem(item, isInterState),
  );

  // Sum item subtotals
  let subtotal = itemCalculations.reduce(
    (acc, item) =>
      acc.plus(new Decimal(item.taxableAmount)).plus(new Decimal(item.discountAmount)),
    new Decimal(0),
  );

  // Invoice-level discount (applied on subtotal before tax)
  let invoiceDiscount = new Decimal(0);
  if (invoiceDiscountType === 'PERCENTAGE' && invoiceDiscountValue) {
    invoiceDiscount = subtotal
      .mul(new Decimal(invoiceDiscountValue))
      .div(100)
      .toDecimalPlaces(2);
  } else if (invoiceDiscountType === 'FIXED' && invoiceDiscountValue) {
    invoiceDiscount = new Decimal(invoiceDiscountValue).toDecimalPlaces(2);
  }

  // Total item-level discounts
  const itemDiscounts = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.discountAmount)),
    new Decimal(0),
  );

  const totalDiscountAmount = itemDiscounts.plus(invoiceDiscount);
  subtotal = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.taxableAmount)).plus(new Decimal(item.discountAmount)),
    new Decimal(0),
  );

  // Recalculate taxable amount after invoice discount
  // We distribute invoice discount proportionally across items for tax purposes
  let taxableAmount: Decimal;
  if (invoiceDiscount.gt(0)) {
    taxableAmount = itemCalculations
      .reduce((acc, item) => acc.plus(new Decimal(item.taxableAmount)), new Decimal(0))
      .minus(invoiceDiscount)
      .toDecimalPlaces(2);
  } else {
    taxableAmount = itemCalculations.reduce(
      (acc, item) => acc.plus(new Decimal(item.taxableAmount)),
      new Decimal(0),
    );
  }

  // Aggregate tax amounts from items
  // (if invoice discount, we recalc proportionally — simplified here to item-level sum)
  let cgstAmount = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.cgstAmount)),
    new Decimal(0),
  );
  let sgstAmount = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.sgstAmount)),
    new Decimal(0),
  );
  let igstAmount = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.igstAmount)),
    new Decimal(0),
  );
  let cessAmount = itemCalculations.reduce(
    (acc, item) => acc.plus(new Decimal(item.cessAmount)),
    new Decimal(0),
  );

  // If invoice-level discount, reduce taxes proportionally
  if (invoiceDiscount.gt(0) && taxableAmount.gt(0)) {
    const originalTaxableFromItems = itemCalculations.reduce(
      (acc, item) => acc.plus(new Decimal(item.taxableAmount)),
      new Decimal(0),
    );
    const ratio = taxableAmount.div(originalTaxableFromItems);
    cgstAmount = cgstAmount.mul(ratio).toDecimalPlaces(2);
    sgstAmount = sgstAmount.mul(ratio).toDecimalPlaces(2);
    igstAmount = igstAmount.mul(ratio).toDecimalPlaces(2);
    cessAmount = cessAmount.mul(ratio).toDecimalPlaces(2);
  }

  const other = new Decimal(otherCharges);
  const shipping = new Decimal(shippingCharges);
  const totalBeforeRound = taxableAmount
    .plus(cgstAmount)
    .plus(sgstAmount)
    .plus(igstAmount)
    .plus(cessAmount)
    .plus(other)
    .plus(shipping);

  // Round-off
  let roundOffAmount = new Decimal(0);
  let grandTotal: Decimal;
  if (roundOff) {
    const rounded = totalBeforeRound.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    roundOffAmount = rounded.minus(totalBeforeRound).toDecimalPlaces(2);
    grandTotal = rounded;
  } else {
    grandTotal = totalBeforeRound.toDecimalPlaces(2);
  }

  // Build tax breakdown for invoice summary table
  const taxBreakdowns: TaxBreakdownEntry[] = [];

  if (!isInterState) {
    // Group by CGST rate
    const cgstGroups = new Map<string, { taxable: Decimal; tax: Decimal }>();
    const sgstGroups = new Map<string, { taxable: Decimal; tax: Decimal }>();

    itemCalculations.forEach((item) => {
      if (new Decimal(item.cgstRate).gt(0)) {
        const key = item.cgstRate;
        const existing = cgstGroups.get(key) ?? { taxable: new Decimal(0), tax: new Decimal(0) };
        cgstGroups.set(key, {
          taxable: existing.taxable.plus(new Decimal(item.taxableAmount)),
          tax: existing.tax.plus(new Decimal(item.cgstAmount)),
        });
        const se = sgstGroups.get(key) ?? { taxable: new Decimal(0), tax: new Decimal(0) };
        sgstGroups.set(key, {
          taxable: se.taxable.plus(new Decimal(item.taxableAmount)),
          tax: se.tax.plus(new Decimal(item.sgstAmount)),
        });
      }
    });

    cgstGroups.forEach((val, rate) => {
      taxBreakdowns.push({
        taxType: 'CGST' as TaxType,
        taxName: `CGST ${rate}%`,
        taxRate: rate,
        taxableAmount: val.taxable.toFixed(2),
        taxAmount: val.tax.toFixed(2),
      });
    });
    sgstGroups.forEach((val, rate) => {
      taxBreakdowns.push({
        taxType: 'SGST' as TaxType,
        taxName: `SGST ${rate}%`,
        taxRate: rate,
        taxableAmount: val.taxable.toFixed(2),
        taxAmount: val.tax.toFixed(2),
      });
    });
  } else {
    const igstGroups = new Map<string, { taxable: Decimal; tax: Decimal }>();
    itemCalculations.forEach((item) => {
      if (new Decimal(item.igstRate).gt(0)) {
        const key = item.igstRate;
        const existing = igstGroups.get(key) ?? { taxable: new Decimal(0), tax: new Decimal(0) };
        igstGroups.set(key, {
          taxable: existing.taxable.plus(new Decimal(item.taxableAmount)),
          tax: existing.tax.plus(new Decimal(item.igstAmount)),
        });
      }
    });
    igstGroups.forEach((val, rate) => {
      taxBreakdowns.push({
        taxType: 'IGST' as TaxType,
        taxName: `IGST ${rate}%`,
        taxRate: rate,
        taxableAmount: val.taxable.toFixed(2),
        taxAmount: val.tax.toFixed(2),
      });
    });
  }

  if (cessAmount.gt(0)) {
    taxBreakdowns.push({
      taxType: 'CESS' as TaxType,
      taxName: 'CESS',
      taxRate: '0',
      taxableAmount: taxableAmount.toFixed(2),
      taxAmount: cessAmount.toFixed(2),
    });
  }

  return {
    subtotal: subtotal.toFixed(2),
    discountAmount: totalDiscountAmount.toFixed(2),
    taxableAmount: taxableAmount.toFixed(2),
    cgstAmount: cgstAmount.toFixed(2),
    sgstAmount: sgstAmount.toFixed(2),
    igstAmount: igstAmount.toFixed(2),
    cessAmount: cessAmount.toFixed(2),
    otherCharges: other.toFixed(2),
    shippingCharges: shipping.toFixed(2),
    roundOff: roundOffAmount.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    itemCalculations,
    taxBreakdowns,
  };
}

/**
 * Convert a number to Indian words (for invoice amount in words).
 */
export function amountToWords(amount: string | number): string {
  const num = Math.round(Number(amount));
  if (isNaN(num)) return '';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }

  if (num === 0) return 'Zero Rupees Only';

  let result = '';
  let n = num;

  if (n >= 10000000) {
    result += convertHundreds(Math.floor(n / 10000000)) + 'Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    result += convertHundreds(Math.floor(n / 100000)) + 'Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += convertHundreds(Math.floor(n / 1000)) + 'Thousand ';
    n %= 1000;
  }
  result += convertHundreds(n);

  return `Rupees ${result.trim()} Only`;
}

/**
 * Format a Decimal string as INR currency.
 */
export function formatCurrency(amount: string | number): string {
  const num = Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}
