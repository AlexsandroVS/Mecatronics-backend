import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../shared/db/prisma.js";
import { ForbiddenError } from "../../shared/errors/app-error.js";
import { validateQuery } from "../../shared/http/validate-request.js";
import type { JwtPayload } from "../auth/auth.types.js";
import { AuditService } from "./audit.service.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().min(1).max(120).optional()
});

export const auditRoutes: FastifyPluginAsync = async (app) => {
  const service = new AuditService(prisma());

  app.get("/", async (req) => {
    const payload = (req.user ?? null) as JwtPayload | null;
    if (!payload || payload.role !== "ADMIN") throw new ForbiddenError({ message: "No autorizado" });

    const q = validateQuery(req, listQuerySchema, "Query inválido");
    const page = q.page ?? 1;
    return service.list({
      page,
      limit: 20,
      entityType: q.entityType,
      entityId: q.entityId,
      actorUserId: q.actorUserId,
      action: q.action
    });
  });
};

