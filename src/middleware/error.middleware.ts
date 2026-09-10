import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorResponse } from '@/lib/api-response';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    const messageParts: string[] = [];

    err.errors.forEach((e) => {
      const field = e.path.join('.');
      errors[field] = errors[field] ?? [];
      errors[field].push(e.message);
      messageParts.push(e.message);
    });

    const message = messageParts.length > 0 ? messageParts.join('. ') : 'Validation failed';
    res.status(422).json(errorResponse(message, errors));
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Unknown errors — log internally but never expose stack
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json(errorResponse('An unexpected error occurred'));
}

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
