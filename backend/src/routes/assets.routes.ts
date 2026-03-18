import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  generateTTSController,
  generateBRollController,
  generateMusicController,
} from '../controllers/assets.controller';
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

const brollRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many b-roll requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const musicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many music requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ScriptRecordIdSchema = z.object({
  body: z.object({
    scriptRecordId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId'),
  }),
});

assetsRouter.post(
  '/tts',
  authenticate,
  ttsRateLimit,
  validate(ScriptRecordIdSchema),
  generateTTSController,
);
assetsRouter.post(
  '/broll',
  authenticate,
  brollRateLimit,
  validate(ScriptRecordIdSchema),
  generateBRollController,
);
assetsRouter.post(
  '/music',
  authenticate,
  musicRateLimit,
  validate(ScriptRecordIdSchema),
  generateMusicController,
);

export default assetsRouter;
