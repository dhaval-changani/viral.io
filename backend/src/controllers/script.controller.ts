import { Request, Response } from 'express';
import { z } from 'zod';
import { generateScript } from '../agents';
import { ViralVideoSchema } from '../agents/schemas';
import { ScriptRecord } from '../models/ScriptRecord';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

/**
 * Request validation schema for POST /api/v1/script/generate
 *
 * Accepts the full ViralVideo object (selected from the Ideation module output)
 * and optional model configuration overrides.
 */
const GenerateScriptRequestSchema = z.object({
  idea: ViralVideoSchema.describe(
    'A validated ViralVideo idea from the Ideation module (response.data.ideas[N])'
  ),
  modelId: z.string().optional().default('gpt-4o'),
  temperature: z.number().min(0).max(1).optional().default(0.6),
});

export type GenerateScriptRequest = z.infer<typeof GenerateScriptRequestSchema>;

/**
 * POST /api/v1/script/generate
 * Generate a full 20+ scene video script from a selected ViralVideo idea.
 *
 * Input: the ViralVideo object produced by POST /api/v1/ideation/generate
 * Output: FullVideoScript with scenes, chapter_markers, CTA, and hook reinforcement
 *
 * @example
 * POST /api/v1/script/generate
 * Content-Type: application/json
 *
 * {
 *   "idea": {
 *     "title": "The Credit Card Trick Banks Hide",
 *     "thumbnail_concept": { ... },
 *     "hook_script": { "type": "Investigator", "spoken_audio": "...", "visual_action": "..." },
 *     "primal_desire": "Greed / wealth accumulation",
 *     "estimated_rpm": 18,
 *     "content_gap_reason": "..."
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "video_title": "...",
 *     "total_duration_seconds": 540,
 *     "scenes": [ { "scene_number": 1, "spoken_script": "...", ... }, ... ],
 *     "intro_hook_reinforcement": "...",
 *     "call_to_action": "...",
 *     "chapter_markers": [ { "timestamp_seconds": 0, "title": "Hook" }, ... ]
 *   },
 *   "idea_title": "...",
 *   "timestamp": "2026-02-25T..."
 * }
 */
export async function generateScriptController(
  req: Request<{}, {}, GenerateScriptRequest>,
  res: Response
) {
  try {
    const validated = GenerateScriptRequestSchema.parse(req.body);

    logger.info(
      `[Controller] Generating script for idea: "${validated.idea.title}"`
    );

    const script = await generateScript(validated.idea, {
      modelId: validated.modelId,
      temperature: validated.temperature,
    });

    const userId = (req as AuthenticatedRequest).user?.sub ?? null;
    ScriptRecord.create({
      userId,
      ideaRecordId: null,
      idea: validated.idea,
      modelId: validated.modelId,
      temperature: validated.temperature,
      result: script,
    }).catch((err: unknown) => {
      logger.error('[Controller] Failed to save ScriptRecord:', err);
    });

    res.status(200).json({
      success: true,
      data: script,
      idea_title: validated.idea.title,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Controller] Error generating script:', error);

    if (error instanceof z.ZodError) {
      // Zod v4: error.format() was removed — use error.issues
      const details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during script generation',
    });
  }
}

/**
 * GET /api/v1/script/health
 * Health check for the script generation service
 */
export async function scriptHealthController(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    service: 'ScriptGenerationModule',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/script/history
 * Return saved script records for the authenticated user, newest first.
 * Query params: page (default 1), limit (default 20, max 100)
 */
export async function scriptHistoryController(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const skip = (page - 1) * limit;

    const userId = (req as AuthenticatedRequest).user.sub;

    const [records, total] = await Promise.all([
      ScriptRecord.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ScriptRecord.countDocuments({ userId }),
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
    logger.error('[Controller] Error fetching script history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching history',
    });
  }
}
