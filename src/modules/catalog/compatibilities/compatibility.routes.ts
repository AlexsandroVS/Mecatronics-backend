import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/db/prisma.js";
import { validateBody, validateParams } from "../../../shared/http/validate-request.js";
import { CompatibilityService } from "./compatibility.service.js";
import { AuditService } from "../../audit/audit.service.js";
import type { JwtPayload } from "../../auth/auth.types.js";
import { requireAdmin } from "../../../shared/auth/require-admin.js";

const productIdParamsSchema = z.object({
  productId: z.coerce.number().int().positive()
});

const createCompatibilitySchema = z.object({
  partId: z.coerce.number().int().positive(),
  machineId: z.coerce.number().int().positive()
});

const deleteCompatibilityParamsSchema = z.object({
  partId: z.coerce.number().int().positive(),
  machineId: z.coerce.number().int().positive()
});

export const compatibilityRoutes: FastifyPluginAsync = async (app) => {
  const db = prisma();
  const service = new CompatibilityService(db);
  const audit = new AuditService(db);

  app.get("/:productId", async (req) => {
    const params = validateParams(req, productIdParamsSchema, "Params inválidos");
    return service.listForProduct(params.productId);
  });

  app.post("/", async (req, reply) => {
    const body = validateBody(req, createCompatibilitySchema, "Body inválido");
    await service.add(body);

    const products = await db.product.findMany({
      where: { id: { in: [body.partId, body.machineId] }, deletedAt: null } as never,
      select: { id: true, name: true, kind: true }
    });
    const part = products.find((p) => p.id === body.partId) ?? null;
    const machine = products.find((p) => p.id === body.machineId) ?? null;

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "COMPATIBILITY_ADD",
        entityType: "ProductCompatibility",
        entityId: null,
        metadata: {
          partId: body.partId,
          partName: part?.name ?? null,
          partKind: part?.kind ?? null,
          machineId: body.machineId,
          machineName: machine?.name ?? null,
          machineKind: machine?.kind ?? null
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(204).send();
  });

  app.delete("/:partId/:machineId", async (req, reply) => {
    requireAdmin(req);
    const params = validateParams(req, deleteCompatibilityParamsSchema, "Params inválidos");
    await service.remove(params);

    const products = await db.product.findMany({
      where: { id: { in: [params.partId, params.machineId] }, deletedAt: null } as never,
      select: { id: true, name: true, kind: true }
    });
    const part = products.find((p) => p.id === params.partId) ?? null;
    const machine = products.find((p) => p.id === params.machineId) ?? null;

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "COMPATIBILITY_REMOVE",
        entityType: "ProductCompatibility",
        entityId: null,
        metadata: {
          partId: params.partId,
          partName: part?.name ?? null,
          partKind: part?.kind ?? null,
          machineId: params.machineId,
          machineName: machine?.name ?? null,
          machineKind: machine?.kind ?? null
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(204).send();
  });
};
