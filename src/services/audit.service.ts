import prisma from '@/lib/db';

export const auditService = {
  async log(params: {
    companyId?: string;
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata ? (params.metadata as any) : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      console.error('Audit log failed silently:', err);
    }
  },

  async getLogs(companyId: string, query: any, action?: string, entity?: string) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
