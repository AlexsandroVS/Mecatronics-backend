import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/db/prisma.js";
import { validateBody, validateParams } from "../../../shared/http/validate-request.js";
import { BrandService } from "./brand.service.js";
import { AuditService } from "../../audit/audit.service.js";
import type { JwtPayload } from "../../auth/auth.types.js";
import { requireAdmin } from "../../../shared/auth/require-admin.js";

const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const brandIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const patchBrandSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const brandRoutes: FastifyPluginAsync = async (app) => {
  const service = new BrandService(prisma());
  const audit = new AuditService(prisma());

  app.get("/", async () => service.list());

  app.post("/", async (req, reply) => {
    const body = validateBody(req, createBrandSchema, "Body inválido");
    const created = await service.create(body);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "BRAND_CREATE",
        entityType: "Brand",
        entityId: created.id,
        metadata: { name: created.name },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(201).send(created);
  });

  app.patch("/:id", async (req) => {
    requireAdmin(req);
    const params = validateParams(req, brandIdParamsSchema, "Params inválidos");
    const body = validateBody(req, patchBrandSchema, "Body inválido");
    const updated = await service.update(params.id, body);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "BRAND_UPDATE",
        entityType: "Brand",
        entityId: updated.id,
        metadata: { name: updated.name },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return updated;
  });
};
