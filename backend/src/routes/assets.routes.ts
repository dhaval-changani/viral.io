import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { generateTTSController } from '../controllers/assets.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const assetsRouter = Router();

const ttsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many TTS requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const TTSRequestSchema = z.object({
  body: z.object({
    scriptRecordId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId'),
  }),
});

assetsRouter.post('/tts', authenticate, ttsRateLimit, validate(TTSRequestSchema), generateTTSController);

export default assetsRouter;
