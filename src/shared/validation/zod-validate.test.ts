import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "../errors/app-error.js";
import { parseOrThrow } from "./zod-validate.js";

describe("parseOrThrow", () => {
  it("returns parsed data when valid", () => {
    const schema = z.object({ quantity: z.number().int().positive() });
    const data = parseOrThrow(schema, { quantity: 2 }, "Body inválido");
    expect(data).toEqual({ quantity: 2 });
  });

  it("throws ValidationError with details when invalid", () => {
    const schema = z.object({ quantity: z.number().int().positive() });

    expect(() => parseOrThrow(schema, { quantity: 0 }, "Body inválido")).toThrow(ValidationError);

    try {
      parseOrThrow(schema, { quantity: 0 }, "Body inválido");
      throw new Error("Expected ValidationError");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      if (!(err instanceof ValidationError)) throw err;

      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(400);
      expect(err.details?.[0]?.path).toBe("quantity");
    }
  });
});

