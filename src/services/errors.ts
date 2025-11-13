import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export class RestError extends Error {
  code: number;
  reason: string;

  constructor(reason: string, code: number) {
    super(`[${code}] ${reason}`);
    this.reason = reason;
    this.code = code;
  }
}

export class UnauthorizedError extends RestError {
  constructor(reason: string) {
    super(reason, 401);
  }
}

export class ForbiddenError extends RestError {
  constructor(reason: string) {
    super(reason, 403);
  }
}

export class NotFoundError extends RestError {
  constructor(reason: string) {
    super(reason, 404);
  }
}

export class ConflictError extends RestError {
  constructor(reason: string) {
    super(reason, 409);
  }
}

export class BadRequestError extends RestError {
  constructor(reason: string) {
    super(reason, 400);
  }
}

export class InternalServerError extends RestError {
  constructor(reason: string) {
    super(reason, 500);
  }
}

export async function errorHandler(
  this: FastifyInstance,
  error: Error & { statusCode?: number; validation?: unknown },
  _req: FastifyRequest,
  res: FastifyReply,
) {
  if (error instanceof RestError) {
    this.log.warn(error.reason);
    return res.code(error.code).send({
      ok: false,
      reason: error.reason,
    });
  }

  // Handle Fastify validation errors
  if (error.statusCode === 400 && error.validation) {
    this.log.warn({ validation: error.validation }, 'Validation error');
    return res.code(400).send({
      ok: false,
      reason: "Validation error",
      validation: error.validation,
    });
  }

  // Handle other Fastify errors with statusCode
  if (error.statusCode) {
    this.log.warn(error.message);
    return res.code(error.statusCode).send({
      ok: false,
      reason: error.message,
    });
  }

  this.log.error(error);
  return res.code(500).send({
    ok: false,
    reason: "Internal server error",
  });
}
