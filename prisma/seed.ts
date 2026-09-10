import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Demo User
  const passwordHash = await bcrypt.hash('Demo@1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@apexenterprises.in' },
    update: {},
    create: {
      email: 'admin@apexenterprises.in',
      passwordHash,
      fullName: 'Vikram Sharma',
      phone: '+91 98765 43210',
      isEmailVerified: true,
    },
  });

  console.log(`👤 User created: ${user.fullName} (${user.email})`);

  // 2. Create Demo Company
  const company = await prisma.company.upsert({
    where: { gstin: '27AAAAA0000A1Z5' },
    update: {},
    create: {
      name: 'Apex Enterprises Pvt Ltd',
      legalName: 'Apex Enterprises Private Limited',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      email: 'billing@apexenterprises.in',
      phone: '+91 22 2456 7890',
      website: 'https://apexenterprises.in',
      businessType: 'B2B_AND_B2C',
      state: 'Maharashtra',
      stateCode: '27',
      currency: 'INR',
      currencySymbol: '₹',
      address: {
        street: '101, Tech Park, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400069',
      },
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
          isDefault: true,
        },
      },
      settings: {
        create: {
          invoicePrefix: 'INV',
          invoiceNumberFormat: 'INV-{YYYY}-{0000}',
          nextInvoiceNumber: 101,
          defaultNotes: 'Thank you for doing business with us!',
          defaultTerms: '1. Payment due within 15 days.\n2. Goods once sold will not be taken back.',
          enableGst: true,
          defaultGstRate: '18.00',
          bankDetails: {
            bankName: 'HDFC Bank',
            accountName: 'Apex Enterprises Pvt Ltd',
            accountNumber: '50200012345678',
            ifscCode: 'HDFC0000123',
            branch: 'Andheri East, Mumbai',
            upiId: 'apex@hdfcbank',
          },
        },
      },
    },
  });

  console.log(`🏢 Company created: ${company.name}`);

  // 3. Create Default Tax Rates
  const taxRatesData = [
    { name: 'GST 0%', rate: '0.00', cgstRate: '0.00', sgstRate: '0.00', igstRate: '0.00', isDefault: false },
    { name: 'GST 5%', rate: '5.00', cgstRate: '2.50', sgstRate: '2.50', igstRate: '5.00', isDefault: false },
    { name: 'GST 12%', rate: '12.00', cgstRate: '6.00', sgstRate: '6.00', igstRate: '12.00', isDefault: false },
    { name: 'GST 18%', rate: '18.00', cgstRate: '9.00', sgstRate: '9.00', igstRate: '18.00', isDefault: true },
    { name: 'GST 28%', rate: '28.00', cgstRate: '14.00', sgstRate: '14.00', igstRate: '28.00', isDefault: false },
  ];

  for (const tr of taxRatesData) {
    await prisma.taxRate.create({
      data: { ...tr, companyId: company.id },
    });
  }

  // 4. Create Units
  const unitsData = [
    { name: 'Pieces', code: 'PCS', precision: 0 },
    { name: 'Kilograms', code: 'KGS', precision: 2 },
    { name: 'Meters', code: 'MTR', precision: 2 },
    { name: 'Boxes', code: 'BOX', precision: 0 },
    { name: 'Hours', code: 'HRS', precision: 1 },
  ];

  const createdUnits: Record<string, string> = {};
  for (const u of unitsData) {
    const unit = await prisma.unit.create({
      data: { ...u, companyId: company.id },
    });
    createdUnits[u.code] = unit.id;
  }

  // 5. Create Product Categories
  const categoriesData = [
    { name: 'Electronics & Hardware', description: 'IT hardware and electronic equipment' },
    { name: 'Services & Consulting', description: 'Professional software and engineering services' },
    { name: 'Office Supplies', description: 'Stationery and daily office needs' },
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const category = await prisma.category.create({
      data: { ...cat, companyId: company.id },
    });
    createdCategories[cat.name] = category.id;
  }

  // 6. Create Demo Customers
  const customer1 = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Rohan Mehta',
      companyName: 'TechSolutions India Pvt Ltd',
      customerType: 'BUSINESS',
      gstin: '27BBBCC1111A1Z8',
      email: 'rohan@techsolutions.in',
      phone: '+91 98200 12345',
      state: 'Maharashtra',
      stateCode: '27',
      billingAddress: {
        street: '402, Business Hub, BKC',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400051',
        country: 'India',
      },
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Priya Sharma',
      companyName: 'Global Softwares LLC',
      customerType: 'BUSINESS',
      gstin: '07AAACG9999K1ZB',
      email: 'priya@globalsoft.com',
      phone: '+91 99100 87654',
      state: 'Delhi',
      stateCode: '07',
      billingAddress: {
        street: '12, Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
      },
    },
  });

  console.log(`👥 Customers created: ${customer1.companyName}, ${customer2.companyName}`);

  // 7. Create Products
  const prod1 = await prisma.product.create({
    data: {
      companyId: company.id,
      name: 'Dell UltraSharp 27" 4K Monitor',
      sku: 'MON-DELL-27',
      hsnSac: '85285200',
      type: 'GOODS',
      sellingPrice: '28500.00',
      purchasePrice: '23000.00',
      gstRate: '18.00',
      isTaxInclusive: false,
      unitId: createdUnits['PCS'],
      categoryId: createdCategories['Electronics & Hardware'],
      currentStock: 25,
      minStockAlert: 5,
    },
  });

  const prod2 = await prisma.product.create({
    data: {
      companyId: company.id,
      name: 'Custom Web Application Development',
      sku: 'SRV-WEB-DEV',
      hsnSac: '998314',
      type: 'SERVICE',
      sellingPrice: '75000.00',
      purchasePrice: '0.00',
      gstRate: '18.00',
      isTaxInclusive: false,
      unitId: createdUnits['HRS'],
      categoryId: createdCategories['Services & Consulting'],
      currentStock: 0,
    },
  });

  console.log(`📦 Products created: ${prod1.name}, ${prod2.name}`);

  // 8. Create Demo Invoices
  // Intra-State Invoice (Maharashtra -> Maharashtra)
  const invoice1 = await prisma.invoice.create({
    data: {
      companyId: company.id,
      invoiceNumber: 'INV-2026-0101',
      customerId: customer1.id,
      customerName: customer1.companyName || customer1.name,
      customerGstin: customer1.gstin,
      customerAddress: customer1.billingAddress as any,
      placeOfSupply: 'Maharashtra',
      placeOfSupplyCode: '27',
      isInterstate: false,
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-16'),
      status: 'PAID',
      paymentStatus: 'PAID',
      subtotal: '28500.00',
      totalTax: '5130.00',
      cgstAmount: '2565.00',
      sgstAmount: '2565.00',
      igstAmount: '0.00',
      totalAmount: '33630.00',
      paidAmount: '33630.00',
      outstandingAmount: '0.00',
      createdById: user.id,
      items: {
        create: [
          {
            productId: prod1.id,
            productName: prod1.name,
            productSku: prod1.sku,
            hsnSac: prod1.hsnSac,
            unitName: 'PCS',
            quantity: '1.00',
            unitPrice: '28500.00',
            discountPercent: '0.00',
            discountAmount: '0.00',
            taxableAmount: '28500.00',
            gstRate: '18.00',
            cgstRate: '9.00',
            sgstRate: '9.00',
            igstRate: '0.00',
            cgstAmount: '2565.00',
            sgstAmount: '2565.00',
            igstAmount: '0.00',
            totalTax: '5130.00',
            totalAmount: '33630.00',
          },
        ],
      },
      payments: {
        create: [
          {
            companyId: company.id,
            paymentNumber: 'PAY-1001',
            amount: '33630.00',
            paymentDate: new Date('2026-09-02'),
            method: 'BANK_TRANSFER',
            referenceNumber: 'HDFC123456789',
            createdById: user.id,
          },
        ],
      },
    },
  });

  // Inter-State Invoice (Maharashtra -> Delhi)
  const invoice2 = await prisma.invoice.create({
    data: {
      companyId: company.id,
      invoiceNumber: 'INV-2026-0102',
      customerId: customer2.id,
      customerName: customer2.companyName || customer2.name,
      customerGstin: customer2.gstin,
      customerAddress: customer2.billingAddress as any,
      placeOfSupply: 'Delhi',
      placeOfSupplyCode: '07',
      isInterstate: true,
      invoiceDate: new Date('2026-09-05'),
      dueDate: new Date('2026-09-20'),
      status: 'PARTIALLY_PAID',
      paymentStatus: 'PARTIALLY_PAID',
      subtotal: '75000.00',
      totalTax: '13500.00',
      cgstAmount: '0.00',
      sgstAmount: '0.00',
      igstAmount: '13500.00',
      totalAmount: '88500.00',
      paidAmount: '50000.00',
      outstandingAmount: '38500.00',
      createdById: user.id,
      items: {
        create: [
          {
            productId: prod2.id,
            productName: prod2.name,
            productSku: prod2.sku,
            hsnSac: prod2.hsnSac,
            unitName: 'HRS',
            quantity: '1.00',
            unitPrice: '75000.00',
            discountPercent: '0.00',
            discountAmount: '0.00',
            taxableAmount: '75000.00',
            gstRate: '18.00',
            cgstRate: '0.00',
            sgstRate: '0.00',
            igstRate: '18.00',
            cgstAmount: '0.00',
            sgstAmount: '0.00',
            igstAmount: '13500.00',
            totalTax: '13500.00',
            totalAmount: '88500.00',
          },
        ],
      },
      payments: {
        create: [
          {
            companyId: company.id,
            paymentNumber: 'PAY-1002',
            amount: '50000.00',
            paymentDate: new Date('2026-09-06'),
            method: 'UPI',
            referenceNumber: 'UPI987654321',
            createdById: user.id,
          },
        ],
      },
    },
  });

  console.log(`📄 Invoices created: ${invoice1.invoiceNumber}, ${invoice2.invoiceNumber}`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
