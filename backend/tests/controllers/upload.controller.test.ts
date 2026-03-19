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
    YOUTUBE_CLIENT_ID: 'test-client-id',
    YOUTUBE_CLIENT_SECRET: 'test-client-secret',
    YOUTUBE_REFRESH_TOKEN: 'test-refresh-token',
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

jest.mock('../../src/models/RenderJob');
jest.mock('../../src/services/youtube.service');

// ── Imports after mocks ────────────────────────────────────────────────────────

import { RenderJob } from '../../src/models/RenderJob';
import * as youtubeService from '../../src/services/youtube.service';
import { getTestApp, resetTestApp } from '../helpers/testServer';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = new mongoose.Types.ObjectId().toHexString();
const JOB_ID = new mongoose.Types.ObjectId().toHexString();
const SCRIPT_ID = new mongoose.Types.ObjectId().toHexString();
const VIDEO_ID = 'dQw4w9WgXcQ';
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const OUTPUT_PATH = `uploads/renders/${SCRIPT_ID}/${JOB_ID}.mp4`;

function makeToken(userId = USER_ID, role = 'user'): string {
  return jwt.sign({ sub: userId, role }, 'test-secret', { expiresIn: '1h' });
}

function makeCompletedJob(overrides: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(JOB_ID),
    id: JOB_ID,
    userId: new mongoose.Types.ObjectId(USER_ID),
    scriptRecordId: new mongoose.Types.ObjectId(SCRIPT_ID),
    status: 'completed',
    videoTitle: 'How Inflation Destroys Wealth',
    outputPath: OUTPUT_PATH,
    error: null as string | null,
    youtubeVideoId: null as string | null,
    youtubeUrl: null as string | null,
    startedAt: new Date(),
    completedAt: null as Date | null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── POST /api/v1/upload ───────────────────────────────────────────────────────

describe('POST /api/v1/upload', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
    jest.clearAllMocks();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/v1/upload').send({ renderJobId: JOB_ID });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ renderJobId: JOB_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 when renderJobId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when renderJobId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: 'not-an-objectid' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when RenderJob does not exist', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'RenderJob not found' });
  });

  it('returns 409 when job is not completed or has no outputPath', async () => {
    const job = makeCompletedJob({ status: 'rendering', outputPath: null });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('not ready for upload');
  });

  it('returns 409 when video has already been uploaded', async () => {
    const job = makeCompletedJob({ youtubeVideoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been uploaded');
  });

  it('returns 409 when another upload is already in progress', async () => {
    const job = makeCompletedJob();
    const inProgressJob = makeCompletedJob({ status: 'uploading' });

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)       // first call: find the job
      .mockResolvedValueOnce(inProgressJob); // second call: find in-progress

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Another upload is already in progress');
  });

  it('returns 200 with upload data on success', async () => {
    const job = makeCompletedJob();

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null); // no in-progress upload

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.buildVideoMetadata as jest.Mock).mockReturnValueOnce({
      title: job.videoTitle,
      description: 'desc',
      tags: ['finance'],
      categoryId: '27',
    });
    (youtubeService.uploadVideo as jest.Mock).mockResolvedValueOnce({
      videoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      renderJobId: JOB_ID,
      status: 'completed',
      videoTitle: 'How Inflation Destroys Wealth',
      youtubeVideoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('sets job status to uploading before calling the service', async () => {
    const job = makeCompletedJob();

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.buildVideoMetadata as jest.Mock).mockReturnValueOnce({
      title: job.videoTitle,
      description: 'desc',
      tags: [],
      categoryId: '27',
    });
    (youtubeService.uploadVideo as jest.Mock).mockResolvedValueOnce({
      videoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });

    await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    // First save: status = 'uploading'; second save: status = 'completed'
    expect(job.save).toHaveBeenCalledTimes(2);
  });

  it('saves youtubeVideoId and youtubeUrl on success', async () => {
    const job = makeCompletedJob();

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.buildVideoMetadata as jest.Mock).mockReturnValueOnce({
      title: job.videoTitle,
      description: 'desc',
      tags: [],
      categoryId: '27',
    });
    (youtubeService.uploadVideo as jest.Mock).mockResolvedValueOnce({
      videoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });

    await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(job.youtubeVideoId).toBe(VIDEO_ID);
    expect(job.youtubeUrl).toBe(YOUTUBE_URL);
    expect(job.status).toBe('completed');
  });

  it('returns 500 and marks job as failed when upload throws', async () => {
    const job = makeCompletedJob();

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.buildVideoMetadata as jest.Mock).mockReturnValueOnce({
      title: job.videoTitle,
      description: 'desc',
      tags: [],
      categoryId: '27',
    });
    (youtubeService.uploadVideo as jest.Mock).mockRejectedValueOnce(
      new Error('YouTube video upload failed: 500. internal error'),
    );

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'YouTube video upload failed: 500. internal error',
    });
    expect(job.status).toBe('failed');
    expect(job.error).toBe('YouTube video upload failed: 500. internal error');
  });

  it('scopes RenderJob lookup to the authenticated user', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ renderJobId: JOB_ID });

    expect(RenderJob.findOne).toHaveBeenCalledWith({ _id: JOB_ID, userId: USER_ID });
  });

  it('calls uploadVideo with the job outputPath', async () => {
    const job = makeCompletedJob();

    (RenderJob.findOne as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);

    const mockMeta = { title: job.videoTitle, description: 'desc', tags: [], categoryId: '27' };
    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.buildVideoMetadata as jest.Mock).mockReturnValueOnce(mockMeta);
    (youtubeService.uploadVideo as jest.Mock).mockResolvedValueOnce({
      videoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });

    await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ renderJobId: JOB_ID });

    expect(youtubeService.uploadVideo).toHaveBeenCalledWith(OUTPUT_PATH, mockMeta, 'ya29.token');
  });
});

// ── POST /api/v1/upload/publish/:jobId ───────────────────────────────────────

describe('POST /api/v1/upload/publish/:jobId', () => {
  let app: ReturnType<typeof getTestApp>;

  beforeEach(() => {
    resetTestApp();
    app = getTestApp();
    jest.clearAllMocks();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post(`/api/v1/upload/publish/${JOB_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobId is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/upload/publish/not-valid')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when RenderJob does not exist', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'RenderJob not found' });
  });

  it('returns 409 when video has not been uploaded yet', async () => {
    const job = makeCompletedJob({ youtubeVideoId: null });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    const res = await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('not been uploaded');
  });

  it('returns 200 with published data on success', async () => {
    const job = makeCompletedJob({ youtubeVideoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.publishVideo as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      renderJobId: JOB_ID,
      videoTitle: 'How Inflation Destroys Wealth',
      youtubeVideoId: VIDEO_ID,
      youtubeUrl: YOUTUBE_URL,
    });
    expect(res.body.data.publishedAt).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('calls publishVideo with the correct videoId and access token', async () => {
    const job = makeCompletedJob({ youtubeVideoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.publishVideo as jest.Mock).mockResolvedValueOnce(undefined);

    await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(youtubeService.publishVideo).toHaveBeenCalledWith(VIDEO_ID, 'ya29.token');
  });

  it('returns 500 when publishVideo throws', async () => {
    const job = makeCompletedJob({ youtubeVideoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL });
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(job);

    (youtubeService.refreshAccessToken as jest.Mock).mockResolvedValueOnce('ya29.token');
    (youtubeService.publishVideo as jest.Mock).mockRejectedValueOnce(
      new Error('YouTube publish failed: 403. forbidden'),
    );

    const res = await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: 'YouTube publish failed: 403. forbidden',
    });
  });

  it('scopes RenderJob lookup to the authenticated user', async () => {
    (RenderJob.findOne as jest.Mock).mockResolvedValueOnce(null);

    await request(app)
      .post(`/api/v1/upload/publish/${JOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(RenderJob.findOne).toHaveBeenCalledWith({ _id: JOB_ID, userId: USER_ID });
  });
});
