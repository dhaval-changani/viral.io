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

jest.mock('express-rate-limit', () => {
  const noop = () => (_req: unknown, _res: unknown, next: () => void) => next();
  return { __esModule: true, default: noop, rateLimit: noop };
});

jest.mock('../../src/models/ScriptRecord');
jest.mock('../../src/models/RenderJob');
jest.mock('../../src/services/remotion.service');

// ── Imports after mocks ────────────────────────────────────────────────────────

import { ScriptRecord } from '../../src/models/ScriptRecord';
import { RenderJob } from '../../src/models/RenderJob';
import * as remotionService from '../../src/services/remotion.service';
import { getTestApp, resetTestApp } from '../helpers/testServer';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toHexString();
const SCRIPT_ID = new mongoose.Types.ObjectId().toHexString();
const JOB_ID = new mongoose.Types.ObjectId().toHexString();

function makeToken(userId = USER_ID, role = 'user'): string {
  return jwt.sign({ sub: userId, role }, 'test-secret', { expiresIn: '1h' });
}

function makeScenes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    scene_number: i + 1,
    duration_seconds: 20,
    spoken_script: `Scene ${i + 1} narration.`,
    visual_description: 'Stock market chart rises.',
    b_roll_prompt: 'Close-up of stock ticker.',
    background_music_mood: 'tense',
  }));
}

function makeScriptRecord() {
  return {
    _id: new mongoose.Types.ObjectId(SCRIPT_ID),
    userId: new mongoose.Types.ObjectId(USER_ID),
    audioUrls: [`/uploads/audio/${SCRIPT_ID}/scene_001.mp3`],
    brollUrls: [`https://cdn.example.com/broll/${SCRIPT_ID}/scene_001.mp4`],
    musicTrack: null,
    result: {
      video_title: 'How Inflation Destroys Wealth',
      scenes: makeScenes(3),
    },
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeRenderJob(overrides: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(JOB_ID),
    id: JOB_ID,
    userId: new mongoose.Types.ObjectId(USER_ID),
    scriptRecordId: new mongoose.Types.ObjectId(SCRIPT_ID),
    status: 'rendering',
    videoTitle: 'How Inflation Destroys Wealth',
    outputPath: null as string | null,
    error: null as string | null,
    startedAt: new Date(),
    completedAt: null as Date | null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── POST /api/v1/render ───────────────────────────────────────────────────────

describe('POST /api/v1/render', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
    jest.clearAllMocks();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/v1/render').send({ scriptRecordId: SCRIPT_ID });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ scriptRecordId: SCRIPT_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 when scriptRecordId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when scriptRecordId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: 'not-an-objectid' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when ScriptRecord does not exist', async () => {
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'ScriptRecord not found' });
  });

  it('returns 200 with render job data on success', async () => {
    const outputPath = `uploads/renders/${SCRIPT_ID}/${JOB_ID}.mp4`;
    const record = makeScriptRecord();
    const job = makeRenderJob();

    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (RenderJob.create as jest.Mock).mockResolvedValueOnce(job);
    (remotionService.renderVideo as jest.Mock).mockResolvedValueOnce(outputPath);

    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      renderJobId: JOB_ID,
      scriptRecordId: SCRIPT_ID,
      status: 'completed',
      outputPath,
      videoTitle: 'How Inflation Destroys Wealth',
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('saves completed status and outputPath to RenderJob', async () => {
    const outputPath = `uploads/renders/${SCRIPT_ID}/${JOB_ID}.mp4`;
    const record = makeScriptRecord();
    const job = makeRenderJob();

    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (RenderJob.create as jest.Mock).mockResolvedValueOnce(job);
    (remotionService.renderVideo as jest.Mock).mockResolvedValueOnce(outputPath);

    await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(job.status).toBe('completed');
    expect(job.outputPath).toBe(outputPath);
    expect(job.completedAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalledTimes(1);
  });

  it('passes correct arguments to renderVideo', async () => {
    const record = makeScriptRecord();
    const job = makeRenderJob();

    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (RenderJob.create as jest.Mock).mockResolvedValueOnce(job);
    (remotionService.renderVideo as jest.Mock).mockResolvedValueOnce('some/path.mp4');

    await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(remotionService.renderVideo).toHaveBeenCalledWith(SCRIPT_ID, JOB_ID, record);
  });

  it('scopes ScriptRecord lookup to the authenticated user', async () => {
    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(null);

    await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(ScriptRecord.findOne).toHaveBeenCalledWith({ _id: SCRIPT_ID, userId: USER_ID });
  });

  it('returns 500 and marks job as failed when renderVideo throws', async () => {
    const record = makeScriptRecord();
    const job = makeRenderJob();

    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (RenderJob.create as jest.Mock).mockResolvedValueOnce(job);
    (remotionService.renderVideo as jest.Mock).mockRejectedValueOnce(
      new Error('Remotion render process failed: exit code 1'),
    );

    const res = await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Remotion render process failed: exit code 1',
    });
    expect(job.status).toBe('failed');
    expect(job.error).toBe('Remotion render process failed: exit code 1');
    expect(job.save).toHaveBeenCalledTimes(1);
  });

  it('does not set outputPath when renderVideo throws', async () => {
    const record = makeScriptRecord();
    const job = makeRenderJob();

    (ScriptRecord.findOne as jest.Mock).mockResolvedValueOnce(record);
    (RenderJob.create as jest.Mock).mockResolvedValueOnce(job);
    (remotionService.renderVideo as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    await request(app)
      .post('/api/v1/render')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ scriptRecordId: SCRIPT_ID });

    expect(job.outputPath).toBeNull();
  });
});

// ── GET /api/v1/render/:jobId ─────────────────────────────────────────────────

describe('GET /api/v1/render/:jobId', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
    jest.clearAllMocks();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get(`/api/v1/render/${JOB_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobId is not a valid ObjectId', async () => {
    const res = await request(app)
      .get('/api/v1/render/not-valid')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when RenderJob does not exist', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/api/v1/render/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'RenderJob not found' });
  });

  it('returns 200 with job data for a completed job', async () => {
    const outputPath = `uploads/renders/${SCRIPT_ID}/${JOB_ID}.mp4`;
    const job = makeRenderJob({ status: 'completed', outputPath, completedAt: new Date() });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    const res = await request(app)
      .get(`/api/v1/render/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      renderJobId: JOB_ID,
      status: 'completed',
      outputPath,
    });
  });

  it('returns 200 with null outputPath for a failed job', async () => {
    const job = makeRenderJob({
      status: 'failed',
      error: 'Render failed',
      completedAt: new Date(),
    });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    const res = await request(app)
      .get(`/api/v1/render/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.error).toBe('Render failed');
    expect(res.body.data.outputPath).toBeNull();
  });

  it('scopes RenderJob lookup to the authenticated user', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    await request(app)
      .get(`/api/v1/render/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(RenderJob.findOne).toHaveBeenCalledWith({ _id: JOB_ID, userId: USER_ID });
  });
});
