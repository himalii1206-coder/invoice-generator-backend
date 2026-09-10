import type { Response } from 'express';
import type { ApiResponse } from '@/types';

export function successResponse<T>(
  res: Response,
  data: T,
  message = 'Success',
  pagination?: Record<string, unknown>
): Response {
  return res.status(200).json({
    success: true,
    data,
    message,
    ...(pagination && { pagination }),
  });
}

export function createdResponse<T>(res: Response, data: T, message = 'Created'): Response {
  return res.status(201).json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(
  message: string,
  errors?: Record<string, string[]>,
): ApiResponse<null> {
  return { success: false, data: null, message, errors };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function parsePaginationQuery(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
  const sortOrder =
    query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : 'desc';

  return { page, limit, search, sortBy, sortOrder, skip: (page - 1) * limit };
}
