import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  generateIdeasController,
  batchGenerateIdeasController,
  ideationHealthController,
  ideationHistoryController,
} from '../controllers/ideation.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const ideationRouter = Router();

// Per-user rate limit: 20 AI generation requests per 15 minutes
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request validation schemas
const GenerateIdeasSchema = z.object({
  body: z.object({
    topic: z
      .string()
      .min(1, 'Topic is required')
      .max(100, 'Topic must be under 100 characters')
      .describe('Finance topic for idea generation'),
    modelId: z.string().optional().default('gpt-4o'),
    temperature: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.7)
      .describe('Creativity level: 0 = deterministic, 1 = creative'),
    maxTokens: z.number().min(500).max(8000).optional().default(4000),
  }),
});

const BatchGenerateSchema = z.object({
  body: z.object({
    topics: z
      .array(
        z
          .string()
          .min(1, 'Each topic must be non-empty')
          .max(100, 'Each topic must be under 100 characters'),
      )
      .min(1, 'At least one topic is required')
      .max(20, 'Maximum 20 topics per batch'),
    concurrency: z
      .number()
      .min(1)
      .max(5)
      .optional()
      .default(3)
      .describe('Parallel requests (respects rate limits)'),
    temperature: z.number().min(0).max(1).optional().default(0.7),
  }),
});

/**
 * POST /api/ideation/generate
 * Generate viral video ideas for a single finance topic
 */
ideationRouter.post(
  '/generate',
  authenticate,
  aiRateLimit,
  validate(GenerateIdeasSchema),
  generateIdeasController,
);

/**
 * POST /api/ideation/batch
 * Generate viral video ideas for multiple finance topics
 */
ideationRouter.post(
  '/batch',
  authenticate,
  aiRateLimit,
  validate(BatchGenerateSchema),
  batchGenerateIdeasController,
);

/**
 * GET /api/ideation/health
 * Health check for the ideation service (public)
 */
ideationRouter.get('/health', ideationHealthController);

/**
 * GET /api/ideation/history
 * Return paginated ideation records for the authenticated user
 */
ideationRouter.get('/history', authenticate, ideationHistoryController);

export default ideationRouter;
