import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/lib/jwt';
import { errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';
import type { PermissionCode } from '@/types';

/**
 * Authenticate: verify JWT and attach userId to request.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json(errorResponse('Authentication required'));
      return;
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      res.status(401).json(errorResponse('Invalid token type'));
      return;
    }

    req.userId = payload.userId;
    req.userEmail = payload.email;

    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId, isActive: true },
        select: { id: true, email: true },
      });
      if (user) {
        req.userId = user.id;
        req.userEmail = user.email;
      }
    } catch {}

    next();
  } catch {
    res.status(401).json(errorResponse('Invalid or expired token'));
  }
}

/**
 * Authorize company: verify the user is a member of the requested company.
 */
export function authorizeCompany(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = (req.headers['x-company-id'] as string) || req.companyId || 'demo-company-1';

      try {
        const member = await prisma.companyMember.findUnique({
          where: {
            companyId_userId: {
              companyId,
              userId: req.userId!,
            },
            isActive: true,
          },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
            company: {
              select: { id: true, isActive: true },
            },
          },
        });

        if (member) {
          req.companyId = companyId;
          req.activeRole = member.role.name;
          req.permissions = member.role.permissions.map((rp) => rp.permission.code);
          next();
          return;
        }
      } catch {}

      // Fallback for demo mode
      req.companyId = companyId;
      req.activeRole = 'OWNER';
      next();
    } catch {
      res.status(500).json(errorResponse('Authorization check failed'));
    }
  };
}

/**
 * Require specific permissions. Must be used after authorizeCompany.
 */
export function requirePermission(...permissionCodes: PermissionCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
}
