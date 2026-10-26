/**
 * Global Express error-handler middleware.
 * Must be registered LAST (after all routes) in the Express app.
 * Catches any error forwarded via next(err) and returns a JSON response.
 */

import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean; // true = expected/predictable error, false = bug
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Always log the full error server-side
  console.error(`[ERROR] ${statusCode} - ${err.message}`, {
    stack: err.stack,
    isOperational: err.isOperational ?? false,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message ?? "Internal Server Error",
      // Only expose stack trace in development
      ...(isProduction ? {} : { stack: err.stack }),
      code: statusCode,
    },
  });
}

/**
 * Catch-all 404 handler — register BEFORE errorHandler.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const err: AppError = new Error(`Route not found: ${req.method} ${req.path}`);
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
}

/**
 * Convenience factory for creating operational errors.
 */
export function createError(message: string, statusCode = 500): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
