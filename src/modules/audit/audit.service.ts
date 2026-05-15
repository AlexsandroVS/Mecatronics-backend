import type { PrismaClient } from "@prisma/client";

export type AuditLogDTO = Readonly<{
  id: number;
  createdAt: string;
  actorUser: null | Readonly<{ id: number; email: string; role: "ADMIN" | "STAFF" }>;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: unknown | null;
  ip: string | null;
  userAgent: string | null;
}>;

export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async log(input: {
    actorUserId: number | null;
    action: string;
    entityType: string;
    entityId: number | null;
    metadata?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null
      }
    });
  }

  async list(input: {
    page: number;
    limit: number;
    entityType?: string;
    entityId?: number;
    actorUserId?: number;
    action?: string;
  }): Promise<AuditLogDTO[]> {
    const where = {
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(typeof input.entityId === "number" ? { entityId: input.entityId } : {}),
      ...(typeof input.actorUserId === "number" ? { actorUserId: input.actorUserId } : {}),
      ...(input.action ? { action: input.action } : {})
    };

    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ip: true,
        userAgent: true,
        actorUser: { select: { id: true, email: true, role: true } }
      }
    });

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorUser: r.actorUser,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      ip: r.ip,
      userAgent: r.userAgent
    }));
  }
}

