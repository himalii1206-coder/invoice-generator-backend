import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '@/middleware/error.middleware';

import authRoutes from '@/routes/auth.routes';
import companyRoutes from '@/routes/company.routes';
import customerRoutes from '@/routes/customer.routes';
import productRoutes from '@/routes/product.routes';
import invoiceRoutes from '@/routes/invoice.routes';
import expenseRoutes from '@/routes/expense.routes';
import analyticsRoutes from '@/routes/analytics.routes';
import reportRoutes from '@/routes/report.routes';
import inventoryRoutes from '@/routes/inventory.routes';
import auditRoutes from '@/routes/audit.routes';
import settingsRoutes from '@/routes/settings.routes';

const app: Application = express();

// Middlewares
app.use(
  cors({
    origin: 'https://inquisitive-duckanoo-52fa3d.netlify.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'GST Billing & Business Management SaaS API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/settings', settingsRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
});

export default app;
