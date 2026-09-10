// ============================================================
// Global TypeScript types for the backend
// ============================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
      activeCompanyId?: string;
      activeRole?: string;
    }
  }
}


export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthenticatedRequest {
  userId: string;
  companyId: string;
  permissions: string[];
}

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// GST Types
export type TaxType = 'CGST' | 'SGST' | 'IGST' | 'CESS' | 'NONE';
export type GstScheme = 'REGULAR' | 'COMPOSITION' | 'EXEMPT';

export interface GstBreakdown {
  taxableAmount: string; // Decimal string
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  cessRate: string;
  cessAmount: string;
  totalTax: string;
}

export interface InvoiceCalculation {
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  otherCharges: string;
  shippingCharges: string;
  roundOff: string;
  grandTotal: string;
  itemCalculations: InvoiceItemCalculation[];
  taxBreakdowns: TaxBreakdownEntry[];
}

export interface InvoiceItemCalculation {
  quantity: string;
  rate: string;
  discountAmount: string;
  taxableAmount: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  cessRate: string;
  cessAmount: string;
  totalAmount: string;
}

export interface TaxBreakdownEntry {
  taxType: TaxType;
  taxName: string;
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
}

export interface InvoiceItemInput {
  productId?: string;
  productName: string;
  productSku?: string;
  hsnSac?: string;
  unitId?: string;
  unitName?: string;
  taxRateId?: string;
  quantity: string;
  rate: string;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: string;
  taxRate?: string;
  cgstRate?: string;
  sgstRate?: string;
  igstRate?: string;
  cessRate?: string;
  sortOrder?: number;
}

// Dashboard / Analytics
export interface DashboardKpis {
  totalSales: string;
  todaySales: string;
  thisMonthSales: string;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueAmount: string;
  totalExpenses: string;
  netRevenue: string;
  gstCollected: string;
  outstandingAmount: string;
}

export interface InvoiceStatusCounts {
  DRAFT: number;
  ISSUED: number;
  SENT: number;
  PARTIALLY_PAID: number;
  PAID: number;
  OVERDUE: number;
  CANCELLED: number;
}

// Permission codes
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'dashboard:view',
  // Customers
  VIEW_CUSTOMERS: 'customers:view',
  MANAGE_CUSTOMERS: 'customers:manage',
  // Products
  VIEW_PRODUCTS: 'products:view',
  MANAGE_PRODUCTS: 'products:manage',
  // Invoices
  VIEW_INVOICES: 'invoices:view',
  CREATE_INVOICE: 'invoices:create',
  EDIT_INVOICE: 'invoices:edit',
  CANCEL_INVOICE: 'invoices:cancel',
  // Payments
  VIEW_PAYMENTS: 'payments:view',
  RECORD_PAYMENT: 'payments:record',
  // Inventory
  VIEW_INVENTORY: 'inventory:view',
  MANAGE_INVENTORY: 'inventory:manage',
  // Expenses
  VIEW_EXPENSES: 'expenses:view',
  MANAGE_EXPENSES: 'expenses:manage',
  // Reports
  VIEW_REPORTS: 'reports:view',
  // Employees
  MANAGE_EMPLOYEES: 'employees:manage',
  // Settings
  MANAGE_COMPANY_SETTINGS: 'settings:company',
  // Audit
  VIEW_AUDIT_LOGS: 'audit:view',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS),
  ACCOUNTANT: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.EDIT_INVOICE,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.RECORD_PAYMENT,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  SALES_MANAGER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.EDIT_INVOICE,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.RECORD_PAYMENT,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
  ],
  SALES_STAFF: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.VIEW_PAYMENTS,
  ],
  INVENTORY_MANAGER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
  ],
  VIEWER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
  ],
};
