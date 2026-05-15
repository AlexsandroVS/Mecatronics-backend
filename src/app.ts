import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { AppError, UnauthorizedError } from "./shared/errors/app-error.js";
import { env } from "./config/env.js";
import { prisma } from "./shared/db/prisma.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { cloudinaryRoutes } from "./modules/images/cloudinary.routes.js";
import { brandRoutes } from "./modules/catalog/brands/brand.routes.js";
import { categoryRoutes } from "./modules/catalog/categories/category.routes.js";
import { compatibilityRoutes } from "./modules/catalog/compatibilities/compatibility.routes.js";
import { productRoutes } from "./modules/catalog/products/product.routes.js";
import { inventoryMovementRoutes } from "./modules/inventory/movements/inventory-movement.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";

export function createApp(opts?: { logger?: boolean }): FastifyInstance {
  const app = Fastify({
    logger: opts?.logger ?? true
  });

  app.register(cors, {
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204
  });

  app.register(jwt, { secret: env.jwtSecret });

  app.get("/health", async () => ({ ok: true }));

  app.register(authRoutes, { prefix: "/auth" });
  app.register(auditRoutes, { prefix: "/audit-logs" });
  app.register(cloudinaryRoutes, { prefix: "/images/cloudinary" });

  app.addHook("preHandler", async (req) => {
    if (req.method === "OPTIONS") return;
    const path = req.url.split("?")[0] ?? req.url;
    if (path === "/health") return;
    if (path === "/auth/login") return;

    try {
      await req.jwtVerify();
    } catch (err) {
      throw new UnauthorizedError({ message: "No autenticado", cause: err });
    }
  });

  app.register(brandRoutes, { prefix: "/brands" });
  app.register(categoryRoutes, { prefix: "/categories" });
  app.register(productRoutes, { prefix: "/products" });
  app.register(compatibilityRoutes, { prefix: "/compatibilities" });
  app.register(inventoryMovementRoutes, { prefix: "/inventory-movements" });
  app.register(userRoutes, { prefix: "/users" });

  app.addHook("onClose", async () => {
    await prisma().$disconnect();
  });

  app.setErrorHandler((err, req, reply) => {
    const requestId = String(req.id);

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.toShape(), requestId });
    }

    req.log.error({ err }, "Unhandled error");
    return reply.status(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Error inesperado" },
      requestId
    });
  });

  return app;
}
