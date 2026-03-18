import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  generateScriptController,
  scriptHealthController,
  scriptHistoryController,
} from '../controllers/script.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';
import { ViralVideoSchema } from '../agents/schemas';

const scriptRouter = Router();

// Per-user rate limit: 10 script generation requests per 15 minutes
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Validation schema for the validate middleware.
 * Wraps the body fields in { body: ... } to match how validate.ts parses requests.
 */
const GenerateScriptSchema = z.object({
  body: z.object({
    idea: ViralVideoSchema.describe(
      'A validated ViralVideo idea from the Ideation module (response.data.ideas[N])',
    ),
    modelId: z.string().optional().default('gpt-4o'),
    temperature: z
      .number()
      .min(0, 'Temperature must be between 0 and 1')
      .max(1, 'Temperature must be between 0 and 1')
      .optional()
      .default(0.6)
      .describe('Creativity level: 0 = deterministic, 1 = highly creative'),
  }),
});

/**
 * POST /api/v1/script/generate
 * Generate a complete 20+ scene video script from a selected viral video idea.
 */
scriptRouter.post(
  '/generate',
  authenticate,
  aiRateLimit,
  validate(GenerateScriptSchema),
  generateScriptController,
);

/**
 * GET /api/v1/script/health
 * Health check for the script generation service (public)
 */
scriptRouter.get('/health', scriptHealthController);

/**
 * GET /api/v1/script/history
 * Return paginated script records for the authenticated user
 */
scriptRouter.get('/history', authenticate, scriptHistoryController);

export default scriptRouter;
