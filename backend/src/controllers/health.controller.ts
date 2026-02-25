import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { ApiResponse } from '../types';

interface HealthData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected';
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

  const data: HealthData = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
  };

  const statusCode = data.status === 'ok' ? 200 : 503;

  const response: ApiResponse<HealthData> = {
    success: data.status === 'ok',
    data,
  };

  res.status(statusCode).json(response);
}
