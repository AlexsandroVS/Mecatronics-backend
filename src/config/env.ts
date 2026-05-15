import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  PORT: z.coerce.number().int().positive().optional(),
  CORS_ORIGINS: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres").optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  STAFF_EMAIL: z.string().email().optional(),
  STAFF_PASSWORD: z.string().min(8).optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  throw new Error(`Env inválido: ${issues}`);
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  port: parsed.data.PORT ?? 3000,
  corsOrigins: parsed.data.CORS_ORIGINS
    ? parsed.data.CORS_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^['"`]+|['"`]+$/g, ""))
        .map((s) => s.replace(/\/+$/, ""))
        .filter(Boolean)
    : [],
  jwtSecret:
    parsed.data.JWT_SECRET ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("Env inválido: JWT_SECRET es requerido en producción");
        })()
      : "dev-secret-change-me-please"),
  cloudinary:
    parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET
      ? {
          cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
          apiKey: parsed.data.CLOUDINARY_API_KEY,
          apiSecret: parsed.data.CLOUDINARY_API_SECRET,
          folder: parsed.data.CLOUDINARY_FOLDER ?? ""
        }
      : null,
  adminEmail: parsed.data.ADMIN_EMAIL,
  adminPassword: parsed.data.ADMIN_PASSWORD,
  staffEmail: parsed.data.STAFF_EMAIL,
  staffPassword: parsed.data.STAFF_PASSWORD
} as const;
