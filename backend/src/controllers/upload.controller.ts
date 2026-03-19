import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { RenderJob } from '../models/RenderJob';
import {
  refreshAccessToken,
  uploadVideo,
  publishVideo,
  buildVideoMetadata,
} from '../services/youtube.service';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

/**
 * POST /api/v1/upload
 *
 * Uploads a rendered MP4 to YouTube as a private video.
 * Enforces the 1-video-at-a-time cadence — rejects if another upload is in progress.
 * The video remains private until explicitly published via POST /api/v1/upload/publish/:jobId.
 */
export async function uploadVideoController(req: Request, res: Response): Promise<void> {
  const { renderJobId } = req.body as { renderJobId: string };
  const userId = (req as AuthenticatedRequest).user.sub;

  if (!renderJobId || !mongoose.isValidObjectId(renderJobId)) {
    res.status(400).json({ success: false, error: 'Invalid renderJobId' });
    return;
  }

  const job = await RenderJob.findOne({ _id: renderJobId, userId });
  if (!job) {
    res.status(404).json({ success: false, error: 'RenderJob not found' });
    return;
  }

  if (job.status !== 'completed' || !job.outputPath) {
    res.status(409).json({
      success: false,
      error: 'RenderJob is not ready for upload (must be in completed status with an output path)',
    });
    return;
  }

  if (job.youtubeVideoId) {
    res.status(409).json({ success: false, error: 'Video has already been uploaded to YouTube' });
    return;
  }

  // Enforce 1-video-at-a-time cadence
  const inProgress = await RenderJob.findOne({ userId, status: 'uploading' });
  if (inProgress) {
    res.status(409).json({
      success: false,
      error: 'Another upload is already in progress. Please wait for it to complete.',
    });
    return;
  }

  job.status = 'uploading';
  await job.save();

  logger.info(`[Upload] Starting YouTube upload for RenderJob ${renderJobId}`);

  try {
    const accessToken = await refreshAccessToken();
    const metadata = buildVideoMetadata(job.videoTitle);
    const { videoId, youtubeUrl } = await uploadVideo(job.outputPath, metadata, accessToken);

    job.status = 'completed';
    job.youtubeVideoId = videoId;
    job.youtubeUrl = youtubeUrl;
    job.completedAt = new Date();
    await job.save();

    logger.info(`[Upload] RenderJob ${renderJobId} uploaded → ${youtubeUrl}`);

    res.status(200).json({
      success: true,
      data: {
        renderJobId: job.id,
        status: job.status,
        videoTitle: job.videoTitle,
        youtubeVideoId: videoId,
        youtubeUrl,
        completedAt: job.completedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';

    job.status = 'failed';
    job.error = message;
    job.completedAt = new Date();
    await job.save();

    logger.error(`[Upload] RenderJob ${renderJobId} upload failed: ${message}`);

    res.status(500).json({ success: false, error: message });
  }
}

/**
 * POST /api/v1/upload/publish/:jobId
 *
 * Makes a previously uploaded (private) YouTube video public.
 * Enforces manual review gate — the video must already be uploaded before publishing.
 */
export async function publishVideoController(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const userId = (req as AuthenticatedRequest).user.sub;

  if (!mongoose.isValidObjectId(jobId)) {
    res.status(400).json({ success: false, error: 'Invalid jobId' });
    return;
  }

  const job = await RenderJob.findOne({ _id: jobId, userId });
  if (!job) {
    res.status(404).json({ success: false, error: 'RenderJob not found' });
    return;
  }

  if (!job.youtubeVideoId) {
    res.status(409).json({
      success: false,
      error: 'Video has not been uploaded to YouTube yet',
    });
    return;
  }

  logger.info(
    `[Upload] Publishing YouTube video ${job.youtubeVideoId} for RenderJob ${jobId}`,
  );

  try {
    const accessToken = await refreshAccessToken();
    await publishVideo(job.youtubeVideoId, accessToken);

    logger.info(`[Upload] YouTube video ${job.youtubeVideoId} is now public`);

    res.status(200).json({
      success: true,
      data: {
        renderJobId: job.id,
        videoTitle: job.videoTitle,
        youtubeVideoId: job.youtubeVideoId,
        youtubeUrl: job.youtubeUrl,
        publishedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown publish error';

    logger.error(`[Upload] Publish failed for RenderJob ${jobId}: ${message}`);

    res.status(500).json({ success: false, error: message });
  }
}
