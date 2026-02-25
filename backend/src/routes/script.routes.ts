import { Router } from 'express';
import { z } from 'zod';
import {
  generateScriptController,
  scriptHealthController,
} from '../controllers/script.controller';
import { validate } from '../middleware/validate';
import { ViralVideoSchema } from '../agents/schemas';

const scriptRouter = Router();

/**
 * Validation schema for the validate middleware.
 * Wraps the body fields in { body: ... } to match how validate.ts parses requests.
 */
const GenerateScriptSchema = z.object({
  body: z.object({
    idea: ViralVideoSchema.describe(
      'A validated ViralVideo idea from the Ideation module (response.data.ideas[N])'
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
 *
 * Pass the ViralVideo object returned by POST /api/v1/ideation/generate (response.data.ideas[N])
 * and receive a FullVideoScript ready for ElevenLabs TTS, Runway B-roll, and Remotion rendering.
 *
 * @example
 * POST /api/v1/script/generate
 * Content-Type: application/json
 *
 * {
 *   "idea": {
 *     "title": "The Credit Card Trick Banks Hide",
 *     "thumbnail_concept": {
 *       "foreground": "Person holding shredded credit card",
 *       "background": "Bank vault closing",
 *       "text_overlay": "BANKS HATE THIS"
 *     },
 *     "hook_script": {
 *       "type": "Investigator",
 *       "spoken_audio": "I found a credit card loophole that banks quietly buried...",
 *       "visual_action": "Hands holding a folded document inside a bank envelope"
 *     },
 *     "primal_desire": "Greed / wealth accumulation",
 *     "estimated_rpm": 18,
 *     "content_gap_reason": "Low-competition credit optimization angle with high search intent"
 *   }
 * }
 */
scriptRouter.post('/generate', validate(GenerateScriptSchema), generateScriptController);

/**
 * GET /api/v1/script/health
 * Health check for the script generation service
 */
scriptRouter.get('/health', scriptHealthController);

export default scriptRouter;
