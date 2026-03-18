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
    EPIDEMIC_SOUND_API_KEY: 'test-epidemic-key',
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
jest.mock('../../src/services/epidemic.service');

// ── Imports after mocks ────────────────────────────────────────────────────────

import { ScriptRecord } from '../../src/models/ScriptRecord';
import * as epidemicService from '../../src/services/epidemic.service';
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
    spoken_script: `Scene ${i + 1} narration text.`,
    visual_description: 'Visual description.',
    b_roll_prompt: `B-roll prompt for scene ${i + 1}.`,
    background_music_mood: 'inspiring',
  }));
}

function makeMusicTrack() {
  return {
    trackId: 'track-abc-123',
    title: 'Epic Finance',
    artistName: 'Studio Artist',
    previewUrl: 'https://cdn.epidemicsound.com/preview.mp3',
    mood: 'inspiring',
  };
}

function makeScriptRecord() {
  return {
    _id: new mongoose.Types.ObjectId(SCRIPT_ID),
    userId: new mongoose.Types.ObjectId(USER_ID),
    musicTrack: null as ReturnType<typeof makeMusicTrack> | null,
    result: { scenes: makeScenes(3) },
    save: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/assets/music', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/v1/assets/music')
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(401);
  });

  it('returns 400 when scriptRecordId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when scriptRecordId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: 'not-an-objectid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when ScriptRecord does not exist', async () => {
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'ScriptRecord not found' });
  });

  it('returns 200 with musicTrack when selection succeeds', async () => {
    const track = makeMusicTrack();
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockResolvedValueOnce(track);

    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      scriptRecordId: SCRIPT_ID,
      musicTrack: track,
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('saves the musicTrack back to the ScriptRecord', async () => {
    const track = makeMusicTrack();
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockResolvedValueOnce(track);

    await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(record.musicTrack).toEqual(track);
    expect(record.save).toHaveBeenCalledTimes(1);
  });

  it('passes the correct scriptRecordId and scenes to selectMusicForScript', async () => {
    const track = makeMusicTrack();
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockResolvedValueOnce(track);

    await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(epidemicService.selectMusicForScript).toHaveBeenCalledWith(
      SCRIPT_ID,
      record.result.scenes,
    );
  });

  it('queries ScriptRecord scoped to the authenticated user', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockResolvedValueOnce(makeMusicTrack());

    await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(ScriptRecord.findOne).toHaveBeenCalledWith({
      _id: SCRIPT_ID,
      userId: USER_ID,
    });
  });

  it('returns 500 when selectMusicForScript throws', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockRejectedValueOnce(
      new Error('Epidemic Sound API error: 429 Too Many Requests'),
    );

    const res = await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Epidemic Sound API error: 429 Too Many Requests',
    });
  });

  it('does not save the record when selectMusicForScript throws', async () => {
    const record = makeScriptRecord();
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (epidemicService.selectMusicForScript as jest.Mock).mockRejectedValueOnce(
      new Error('No tracks found for mood: calm'),
    );

    await request(app)
      .post('/api/v1/assets/music')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(record.save).not.toHaveBeenCalled();
  });
});
