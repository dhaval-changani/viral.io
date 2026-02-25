import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${err.message}`, err.stack);
  } else {
    logger.warn(`[${statusCode}] ${err.message}`);
  }

  const response: ApiResponse = {
    success: false,
    error: err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  };

  res.status(statusCode).json(response);
}
