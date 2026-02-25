import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { createRequestLogger } from './middleware/requestLogger';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/index';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Request logging (skip in test environment)
  if (env.NODE_ENV !== 'test') {
    app.use(createRequestLogger());
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use('/api/v1', apiRouter);

  // 404 handler — must come after all routes
  app.use(notFound);

  // Global error handler — must be last, must have 4 args
  app.use(errorHandler);

  return app;
}
