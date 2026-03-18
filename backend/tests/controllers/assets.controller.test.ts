import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3000,
    CORS_ORIGIN: '*',
    MONGODB_URI: 'mongodb://localhost/test',
    OPENAI_API_KEY: 'test',
    ELEVENLABS_API_KEY: 'test',
    ELEVENLABS_VOICE_ID: 'test-voice',
    RUNWAY_API_KEY: 'test',
    EPIDEMIC_SOUND_API_KEY: 'test',
    YOUTUBE_API_KEY: 'test',
    YOUTUBE_CLIENT_ID: 'test',
    YOUTUBE_CLIENT_SECRET: 'test',
    YOUTUBE_REFRESH_TOKEN: 'test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h',
  },
}));

jest.mock('../../src/config/database', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
  disconnectDB: jest.fn().mockResolvedValue(undefined),
}));

// Bypass rate limiting so tests don't affect each other
jest.mock('express-rate-limit', () => {
  const noop = () => (_req: unknown, _res: unknown, next: () => void) => next();
  return { __esModule: true, default: noop, rateLimit: noop };
});

jest.mock('../../src/models/ScriptRecord');
jest.mock('../../src/services/elevenlabs.service');

// ── Imports after mocks ────────────────────────────────────────────────────────

import { ScriptRecord } from '../../src/models/ScriptRecord';
import * as elevenlabsService from '../../src/services/elevenlabs.service';
import { getTestApp, resetTestApp } from '../helpers/testServer';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toHexString();
const SCRIPT_ID = new mongoose.Types.ObjectId().toHexString();

function makeToken(userId = USER_ID, role = 'user'): string {
  return jwt.sign({ sub: userId, role }, 'test-secret', { expiresIn: '1h' });
}

function makeScenes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    scene_number: i + 1,
    duration_seconds: 20,
    spoken_script: `Scene ${i + 1} narration text for testing purposes.`,
    visual_description: 'Visual description for scene.',
    b_roll_prompt: 'B-roll prompt for scene.',
    background_music_mood: 'neutral',
  }));
}

function makeScriptRecord() {
  return {
    _id: new mongoose.Types.ObjectId(SCRIPT_ID),
    userId: new mongoose.Types.ObjectId(USER_ID),
    audioUrls: [] as string[],
    result: { scenes: makeScenes(3) },
    save: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/tts', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/v1/assets/tts').send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(401);
  });

  it('returns 400 when scriptRecordId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when scriptRecordId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: 'not-an-objectid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when ScriptRecord does not exist', async () => {
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'ScriptRecord not found' });
  });

  it('returns 200 with audio URLs when generation succeeds', async () => {
    const fakeUrls = [
      `/uploads/audio/${SCRIPT_ID}/scene_001.mp3`,
      `/uploads/audio/${SCRIPT_ID}/scene_002.mp3`,
      `/uploads/audio/${SCRIPT_ID}/scene_003.mp3`,
    ];
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockResolvedValueOnce(fakeUrls);

    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      scriptRecordId: SCRIPT_ID,
      audioUrls: fakeUrls,
      sceneCount: 3,
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('saves the audioUrls back to the ScriptRecord', async () => {
    const fakeUrls = [`/uploads/audio/${SCRIPT_ID}/scene_001.mp3`];
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockResolvedValueOnce(fakeUrls);

    await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(record.audioUrls).toEqual(fakeUrls);
    expect(record.save).toHaveBeenCalledTimes(1);
  });

  it('passes the correct scriptRecordId and scenes to generateSceneAudio', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockResolvedValueOnce([]);

    await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(elevenlabsService.generateSceneAudio).toHaveBeenCalledWith(
      SCRIPT_ID,
      record.result.scenes,
    );
  });

  it('queries ScriptRecord scoped to the authenticated user', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockResolvedValueOnce([]);

    await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(ScriptRecord.findOne).toHaveBeenCalledWith({
      _id: SCRIPT_ID,
      userId: USER_ID,
    });
  });

  it('returns 500 when generateSceneAudio throws', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockRejectedValueOnce(
      new Error('ElevenLabs rate limit exceeded after 5 retries'),
    );

    const res = await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'ElevenLabs rate limit exceeded after 5 retries',
    });
  });

  it('does not save the record when generateSceneAudio throws', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (elevenlabsService.generateSceneAudio as jest.Mock).mockRejectedValueOnce(
      new Error('API error'),
    );

    await request(app)
      .post('/api/v1/assets/tts')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(record.save).not.toHaveBeenCalled();
  });
});
