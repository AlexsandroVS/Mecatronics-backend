import { z } from "zod";
import { ValidationError, type ErrorDetail } from "../errors/app-error.js";

export function parseOrThrow<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  message: string
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  const details: ErrorDetail[] = parsed.error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message
  }));

  throw new ValidationError({ message, details, cause: parsed.error });
}

