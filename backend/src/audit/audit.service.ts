import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  userId?: number;
  userRole?: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  oldValue?: any;
  newValue?: any;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          userRole: input.userRole || null,
          action: input.action,
          targetEntity: input.targetEntity,
          targetId: input.targetId || null,
          oldValue: input.oldValue ? input.oldValue : undefined,
          newValue: input.newValue ? input.newValue : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  async findAll(options?: {
    userId?: number;
    targetEntity?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (options?.userId) where.userId = options.userId;
    if (options?.targetEntity) where.targetEntity = options.targetEntity;
    if (options?.action) where.action = options.action;

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    return { total, logs };
  }
}
