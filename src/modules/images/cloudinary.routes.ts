import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { validateQuery } from "../../shared/http/validate-request.js";

const signQuerySchema = z.object({
  folder: z.string().trim().min(1).optional()
});

function cloudinarySignature(paramsToSign: Record<string, string>, apiSecret: string): string {
  const entries = Object.entries(paramsToSign).sort(([a], [b]) => a.localeCompare(b));
  const payload = entries.map(([k, v]) => `${k}=${v}`).join("&") + apiSecret;
  return createHash("sha1").update(payload).digest("hex");
}

export const cloudinaryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/sign", async (req) => {
    const cfg = env.cloudinary;
    if (!cfg) throw new ValidationError({ message: "Cloudinary no está configurado" });

    const query = validateQuery(req, signQuerySchema, "Query inválido");
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = query.folder ?? cfg.folder;
    if (!folder) throw new ValidationError({ message: "Folder es requerido" });

    const signature = cloudinarySignature({ folder, timestamp: String(timestamp) }, cfg.apiSecret);

    return {
      cloudName: cfg.cloudName,
      apiKey: cfg.apiKey,
      timestamp,
      folder,
      signature
    };
  });
};

