import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ScriptRecord } from '../models/ScriptRecord';
import { generateSceneAudio } from '../services/elevenlabs.service';
import { generateSceneBRoll } from '../services/runway.service';
import { selectMusicForScript } from '../services/epidemic.service';
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

export async function generateBRollController(req: Request, res: Response): Promise<void> {
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

    logger.info(`[Assets] Starting b-roll generation for ScriptRecord ${scriptRecordId}`);

    const brollUrls = await generateSceneBRoll(scriptRecordId, record.result.scenes);

    record.brollUrls = brollUrls;
    await record.save();

    logger.info(
      `[Assets] B-roll complete for ScriptRecord ${scriptRecordId}: ${brollUrls.length} scenes`,
    );

    res.status(200).json({
      success: true,
      data: {
        scriptRecordId,
        brollUrls,
        sceneCount: brollUrls.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Assets] Error generating b-roll:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during b-roll generation',
    });
  }
}

export async function generateMusicController(req: Request, res: Response): Promise<void> {
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

    logger.info(`[Assets] Starting music selection for ScriptRecord ${scriptRecordId}`);

    const musicTrack = await selectMusicForScript(scriptRecordId, record.result.scenes);

    record.musicTrack = musicTrack;
    await record.save();

    logger.info(
      `[Assets] Music selection complete for ScriptRecord ${scriptRecordId}: "${musicTrack.title}" by ${musicTrack.artistName}`,
    );

    res.status(200).json({
      success: true,
      data: {
        scriptRecordId,
        musicTrack,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Assets] Error selecting music:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during music selection',
    });
  }
}
