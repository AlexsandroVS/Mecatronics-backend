export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR";

export type ErrorDetail = Readonly<{
  path: string;
  message: string;
}>;

export type AppErrorShape = Readonly<{
  code: ErrorCode;
  message: string;
  details?: readonly ErrorDetail[];
}>;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: readonly ErrorDetail[];

  constructor(input: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: readonly ErrorDetail[];
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.details = input.details;
  }

  toShape(): AppErrorShape {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export class ValidationError extends AppError {
  constructor(input: { message: string; details?: readonly ErrorDetail[]; cause?: unknown }) {
    super({
      code: "VALIDATION_ERROR",
      message: input.message,
      statusCode: 400,
      details: input.details,
      cause: input.cause
    });
  }
}

export class NotFoundError extends AppError {
  constructor(input: { message: string; cause?: unknown }) {
    super({ code: "NOT_FOUND", message: input.message, statusCode: 404, cause: input.cause });
  }
}

export class ConflictError extends AppError {
  constructor(input: { message: string; cause?: unknown }) {
    super({ code: "CONFLICT", message: input.message, statusCode: 409, cause: input.cause });
  }
}

export class UnauthorizedError extends AppError {
  constructor(input: { message: string; cause?: unknown }) {
    super({ code: "UNAUTHORIZED", message: input.message, statusCode: 401, cause: input.cause });
  }
}

export class ForbiddenError extends AppError {
  constructor(input: { message: string; cause?: unknown }) {
    super({ code: "FORBIDDEN", message: input.message, statusCode: 403, cause: input.cause });
  }
}

