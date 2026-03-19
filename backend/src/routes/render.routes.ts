import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { triggerRenderController, getRenderJobController } from '../controllers/render.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const renderRouter = Router();

const renderRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many render requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const TriggerRenderSchema = z.object({
  body: z.object({
    scriptRecordId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId'),
  }),
});

renderRouter.post('/', authenticate, renderRateLimit, validate(TriggerRenderSchema), triggerRenderController);
renderRouter.get('/:jobId', authenticate, getRenderJobController);

export default renderRouter;
