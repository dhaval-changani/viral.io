import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ScriptRecord } from '../models/ScriptRecord';
import { RenderJob } from '../models/RenderJob';
import { renderVideo } from '../services/remotion.service';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

/**
 * POST /api/v1/render
 *
 * Triggers a Remotion render job for the given ScriptRecord.
 * Creates a RenderJob document to track status and stores the output MP4 path
 * on completion.
 */
export async function triggerRenderController(req: Request, res: Response): Promise<void> {
  const { scriptRecordId } = req.body as { scriptRecordId: string };
  const userId = (req as AuthenticatedRequest).user.sub;

  if (!scriptRecordId || !mongoose.isValidObjectId(scriptRecordId)) {
    res.status(400).json({ success: false, error: 'Invalid scriptRecordId' });
    return;
  }

  const record = await ScriptRecord.findOne({ _id: scriptRecordId, userId });
  if (!record) {
    res.status(404).json({ success: false, error: 'ScriptRecord not found' });
    return;
  }

  // Create the job record before starting so we have an ID to track
  const job = await RenderJob.create({
    userId,
    scriptRecordId,
    status: 'rendering',
    videoTitle: record.result.video_title,
    startedAt: new Date(),
  });

  logger.info(`[Render] Job ${job.id} started for ScriptRecord ${scriptRecordId}`);

  try {
    const outputPath = await renderVideo(String(scriptRecordId), String(job.id), record);

    job.status = 'completed';
    job.outputPath = outputPath;
    job.completedAt = new Date();
    await job.save();

    logger.info(`[Render] Job ${job.id} completed → ${outputPath}`);

    res.status(200).json({
      success: true,
      data: {
        renderJobId: job.id,
        scriptRecordId,
        status: job.status,
        outputPath,
        videoTitle: job.videoTitle,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown render error';

    job.status = 'failed';
    job.error = message;
    job.completedAt = new Date();
    await job.save();

    logger.error(`[Render] Job ${job.id} failed: ${message}`);

    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/v1/render/:jobId
 *
 * Returns the current status and output path (if completed) of a render job.
 */
export async function getRenderJobController(req: Request, res: Response): Promise<void> {
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

  res.status(200).json({
    success: true,
    data: {
      renderJobId: job.id,
      scriptRecordId: job.scriptRecordId,
      status: job.status,
      outputPath: job.outputPath,
      videoTitle: job.videoTitle,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
    timestamp: new Date().toISOString(),
  });
}
