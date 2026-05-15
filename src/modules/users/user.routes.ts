import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../shared/db/prisma.js";
import { validateBody, validateParams } from "../../shared/http/validate-request.js";
import { requireAdmin } from "../../shared/auth/require-admin.js";
import { UserService } from "./user.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { JwtPayload } from "../auth/auth.types.js";

const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const createUserSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "STAFF"])
});

const patchUserSchema = z
  .object({
    email: z.string().email().max(200).optional(),
    password: z.string().min(8).max(200).optional(),
    role: z.enum(["ADMIN", "STAFF"]).optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "Debe enviar al menos un campo" });

export const userRoutes: FastifyPluginAsync = async (app) => {
  const service = new UserService(prisma());
  const audit = new AuditService(prisma());

  app.get("/", async (req) => {
    requireAdmin(req);
    return service.list();
  });

  app.post("/", async (req, reply) => {
    requireAdmin(req);
    const body = validateBody(req, createUserSchema, "Body inválido");
    const created = await service.create(body);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "USER_CREATE",
        entityType: "User",
        entityId: created.id,
        metadata: { email: created.email, role: created.role },
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
    const params = validateParams(req, userIdParamsSchema, "Params inválidos");
    const body = validateBody(req, patchUserSchema, "Body inválido");
    const updated = await service.update(params.id, body);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: updated.id,
        metadata: { email: updated.email, role: updated.role },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return updated;
  });

  app.delete("/:id", async (req, reply) => {
    requireAdmin(req);
    const params = validateParams(req, userIdParamsSchema, "Params inválidos");
    await service.delete(params.id);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "USER_DELETE",
        entityType: "User",
        entityId: params.id,
        metadata: {},
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(204).send();
  });
};

