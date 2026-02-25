import type { Request, Response } from 'express';
import type { ApiResponse } from '../types';

export function notFound(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  };
  res.status(404).json(response);
}
