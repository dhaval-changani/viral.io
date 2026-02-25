import { Request, Response } from 'express';
import { z } from 'zod';
import { generateViralIdeas, generateViralIdeasBatch } from '../agents';
import { logger } from '../utils/logger';

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

    logger.info(`[Controller] Generating ideas for topic: "${validated.topic}"`);

    const ideas = await generateViralIdeas(validated.topic, {
      modelId: validated.modelId,
      temperature: validated.temperature,
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
