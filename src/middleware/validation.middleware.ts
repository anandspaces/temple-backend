import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger.ts";

type SchemaLike<T = unknown> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues?: Array<{ message?: string }>; message?: string } };
};

export function validateBody<T>(schema: SchemaLike<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err = result.error;
      const message =
        err.issues?.map((e) => e.message ?? "invalid").join("; ") ?? err.message ?? "Validation failed";
      logger.warn({ path: req.path, message }, "Request validation failed");
      return res.status(400).json({ success: false, error: message });
    }
    (req as Request & { validatedBody: T }).validatedBody = result.data;
    next();
  };
}
