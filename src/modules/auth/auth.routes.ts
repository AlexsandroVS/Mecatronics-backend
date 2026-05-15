import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../shared/db/prisma.js";
import { validateBody } from "../../shared/http/validate-request.js";
import { AuthService } from "./auth.service.js";
import type { JwtPayload } from "./auth.types.js";
import { AuditService } from "../audit/audit.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  const service = new AuthService(prisma());
  const audit = new AuditService(prisma());

  app.post("/login", async (req) => {
    const body = validateBody(req, loginSchema, "Body inválido");
    const user = await service.login(body);
    const token = app.jwt.sign({ uid: user.id, role: user.role } satisfies JwtPayload);

    try {
      await audit.log({
        actorUserId: user.id,
        action: "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return { token, user };
  });

  app.get("/me", async (req) => {
    const payload = (req.user ?? null) as JwtPayload | null;
    if (!payload) return null;

    const user = await prisma().user.findUnique({
      where: { id: payload.uid },
      select: { id: true, email: true, role: true }
    });
    return user;
  });
};
