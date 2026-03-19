import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { uploadVideoController, publishVideoController } from '../controllers/upload.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const uploadRouter = Router();

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.sub ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many upload requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const UploadVideoSchema = z.object({
  body: z.object({
    renderJobId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId'),
  }),
});

uploadRouter.post(
  '/',
  authenticate,
  uploadRateLimit,
  validate(UploadVideoSchema),
  uploadVideoController,
);

uploadRouter.post('/publish/:jobId', authenticate, publishVideoController);

export default uploadRouter;
