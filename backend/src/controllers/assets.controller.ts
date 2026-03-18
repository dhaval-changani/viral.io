import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ScriptRecord } from '../models/ScriptRecord';
import { generateSceneAudio } from '../services/elevenlabs.service';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

export async function generateTTSController(req: Request, res: Response): Promise<void> {
  try {
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

    logger.info(`[Assets] Starting TTS generation for ScriptRecord ${scriptRecordId}`);

    const audioUrls = await generateSceneAudio(scriptRecordId, record.result.scenes);

    record.audioUrls = audioUrls;
    await record.save();

    logger.info(
      `[Assets] TTS complete for ScriptRecord ${scriptRecordId}: ${audioUrls.length} scenes`,
    );

    res.status(200).json({
      success: true,
      data: {
        scriptRecordId,
        audioUrls,
        sceneCount: audioUrls.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Assets] Error generating TTS:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during TTS generation',
    });
  }
}
