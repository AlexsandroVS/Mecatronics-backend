import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../validation/zod-validate.js";

export function validateBody<TSchema extends z.ZodTypeAny>(
  req: FastifyRequest,
  schema: TSchema,
  message = "Body inválido"
): z.infer<TSchema> {
  return parseOrThrow(schema, req.body, message);
}

export function validateQuery<TSchema extends z.ZodTypeAny>(
  req: FastifyRequest,
  schema: TSchema,
  message = "Query inválido"
): z.infer<TSchema> {
  return parseOrThrow(schema, req.query, message);
}

export function validateParams<TSchema extends z.ZodTypeAny>(
  req: FastifyRequest,
  schema: TSchema,
  message = "Params inválidos"
): z.infer<TSchema> {
  return parseOrThrow(schema, req.params, message);
}

