import { Request, Response } from 'express';
import { z } from 'zod';
import { generateViralIdeas, generateViralIdeasBatch } from '../agents';
import { IdeaRecord } from '../models/IdeaRecord';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

// Request validation schemas
const GenerateIdeasRequestSchema = z.object({
  topic: z.string().min(1).max(100).describe('Finance topic for idea generation'),
  modelId: z.string().optional().default('gpt-4o'),
  temperature: z.number().min(0).max(1).optional().default(0.7),
});

const BatchGenerateRequestSchema = z.object({
  topics: z.array(z.string().min(1).max(100)).min(1).max(20).describe('Array of finance topics'),
  concurrency: z.number().optional().default(3),
  temperature: z.number().min(0).max(1).optional().default(0.7),
});

export type GenerateIdeasRequest = z.infer<typeof GenerateIdeasRequestSchema>;
export type BatchGenerateRequest = z.infer<typeof BatchGenerateRequestSchema>;

/**
 * POST /api/ideation/generate
 * Generate viral video ideas for a single finance topic
 */
export async function generateIdeasController(
  req: Request<{}, {}, GenerateIdeasRequest>,
  res: Response,
) {
  try {
    const validated = GenerateIdeasRequestSchema.parse(req.body);
    logger.debug(`[Controller] validated request`, validated);

    logger.info(`[Controller] Generating ideas for topic: "${validated.topic}"`);

    const ideas = await generateViralIdeas(validated.topic, {
      modelId: validated.modelId,
      temperature: validated.temperature,
    });

    const userId = (req as AuthenticatedRequest).user?.sub ?? null;
    IdeaRecord.create({
      userId,
      topic: validated.topic,
      modelId: validated.modelId,
      temperature: validated.temperature,
      result: ideas,
    }).catch((err: unknown) => {
      logger.error('[Controller] Failed to save IdeaRecord:', err);
    });

    res.status(200).json({
      success: true,
      data: ideas,
      topic: validated.topic,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Controller] Error generating ideas:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.format(),
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during idea generation',
    });
  }
}

/**
 * POST /api/ideation/batch
 * Generate viral video ideas for multiple finance topics in parallel
 */
export async function batchGenerateIdeasController(
  req: Request<{}, {}, BatchGenerateRequest>,
  res: Response,
) {
  try {
    const validated = BatchGenerateRequestSchema.parse(req.body);

    logger.info(`[Controller] Batch generating ideas for ${validated.topics.length} topics`);

    const results = await generateViralIdeasBatch(validated.topics, {
      temperature: validated.temperature,
      concurrency: validated.concurrency,
    });

    res.status(200).json({
      success: true,
      data: results,
      summary: {
        totalTopics: validated.topics.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Controller] Error in batch generation:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.format(),
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during batch generation',
    });
  }
}

/**
 * GET /api/ideation/health
 * Health check for the ideation service
 */
export async function ideationHealthController(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    service: 'ViralIdeationModule',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/ideation/history
 * Return saved ideation records for the authenticated user, newest first.
 * Query params: page (default 1), limit (default 20, max 100)
 */
export async function ideationHistoryController(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const skip = (page - 1) * limit;

    const userId = (req as AuthenticatedRequest).user.sub;

    const [records, total] = await Promise.all([
      IdeaRecord.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      IdeaRecord.countDocuments({ userId }),
    ]);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Controller] Error fetching ideation history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching history',
    });
  }
}
