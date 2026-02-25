import { Router } from 'express';
import {
  generateIdeasController,
  batchGenerateIdeasController,
  ideationHealthController,
} from '../controllers/ideation.controller';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const ideationRouter = Router();

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
 *
 * @example
 * POST /api/ideation/generate
 * Content-Type: application/json
 *
 * {
 *   "topic": "Credit Cards",
 *   "temperature": 0.7,
 *   "maxTokens": 4000
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "topic_analysis": "...",
 *     "ideas": [
 *       {
 *         "title": "...",
 *         "hook_script": {...},
 *         "primal_desire": "...",
 *         ...
 *       }
 *     ]
 *   }
 * }
 */
ideationRouter.post('/generate', validate(GenerateIdeasSchema), generateIdeasController);

/**
 * POST /api/ideation/batch
 * Generate viral video ideas for multiple finance topics
 *
 * @example
 * POST /api/ideation/batch
 * Content-Type: application/json
 *
 * {
 *   "topics": ["Credit Cards", "Side Hustles", "Tax Hacks"],
 *   "concurrency": 3,
 *   "temperature": 0.7
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "successful": [...],
 *     "failed": [...]
 *   },
 *   "summary": {
 *     "totalTopics": 3,
 *     "successful": 3,
 *     "failed": 0
 *   }
 * }
 */
ideationRouter.post('/batch', validate(BatchGenerateSchema), batchGenerateIdeasController);

/**
 * GET /api/ideation/health
 * Health check for the ideation service
 */
ideationRouter.get('/health', ideationHealthController);

export default ideationRouter;
