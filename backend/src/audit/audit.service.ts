import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestIdFromContext } from '../common/request-context';

export interface AuditLogFilters {
  entity?: string;
  action?: string;
  requestId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  logAction(action: string, entity: string, entityId?: number, details?: string) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details,
        requestId: getRequestIdFromContext(),
      },
    });
  }

  getLogs(filters: AuditLogFilters = {}) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entity) {
      where.entity = filters.entity;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.requestId) {
      where.requestId = { contains: filters.requestId };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
