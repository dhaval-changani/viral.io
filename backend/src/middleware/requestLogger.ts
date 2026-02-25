import morgan from 'morgan';
import type { RequestHandler } from 'express';

export function createRequestLogger(): RequestHandler {
  const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  return morgan(format);
}
