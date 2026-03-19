// Mock fs before importing the service
jest.mock('fs', () => ({
  statSync: jest.fn().mockReturnValue({ size: 1024 * 1024 }), // 1 MB
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-video-data')),
}));

// Mock env
jest.mock('../../src/config/env', () => ({
  env: {
    YOUTUBE_CLIENT_ID: 'test-client-id',
    YOUTUBE_CLIENT_SECRET: 'test-client-secret',
    YOUTUBE_REFRESH_TOKEN: 'test-refresh-token',
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { statSync, readFileSync } from 'fs';
import {
  refreshAccessToken,
  buildVideoMetadata,
  uploadVideo,
  publishVideo,
  sleep,
} from '../../src/services/youtube.service';

// ── Helper response factories ─────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as Response;
}

function makeInitSessionResponse(locationUrl: string): Response {
  return {
    status: 200,
    ok: true,
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
    headers: {
      get: jest.fn().mockImplementation((key: string) =>
        key === 'Location' ? locationUrl : null,
      ),
    },
  } as unknown as Response;
}

function makeErrorResponse(status: number, body = 'error body'): Response {
  return {
    status,
    ok: false,
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as Response;
}

// ── sleep ─────────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    jest.useFakeTimers();
    const promise = sleep(500);
    jest.advanceTimersByTime(500);
    await promise;
    jest.useRealTimers();
  });
});

// ── refreshAccessToken ────────────────────────────────────────────────────────

describe('refreshAccessToken', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('returns the access token on success', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ access_token: 'ya29.test-token' }));

    const token = await refreshAccessToken();

    expect(token).toBe('ya29.test-token');
  });

  it('sends correct OAuth2 parameters', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ access_token: 'ya29.test-token' }));

    await refreshAccessToken();

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(opts.method).toBe('POST');

    const bodyString = opts.body?.toString() ?? '';
    expect(bodyString).toContain('grant_type=refresh_token');
    expect(bodyString).toContain('client_id=test-client-id');
    expect(bodyString).toContain('client_secret=test-client-secret');
    expect(bodyString).toContain('refresh_token=test-refresh-token');
  });

  it('throws when the token endpoint returns an error', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(400, 'invalid_grant'));

    await expect(refreshAccessToken()).rejects.toThrow(
      'YouTube OAuth2 token refresh failed: 400. invalid_grant',
    );
  });
});

// ── buildVideoMetadata ────────────────────────────────────────────────────────

describe('buildVideoMetadata', () => {
  it('returns a metadata object with the correct title', () => {
    const meta = buildVideoMetadata('How Inflation Destroys Wealth');
    expect(meta.title).toBe('How Inflation Destroys Wealth');
  });

  it('includes the title in the description', () => {
    const meta = buildVideoMetadata('How Inflation Destroys Wealth');
    expect(meta.description).toContain('How Inflation Destroys Wealth');
  });

  it('returns education category (27)', () => {
    const meta = buildVideoMetadata('Test Title');
    expect(meta.categoryId).toBe('27');
  });

  it('returns finance-related tags', () => {
    const meta = buildVideoMetadata('Test Title');
    expect(meta.tags).toContain('personal finance');
    expect(meta.tags).toContain('investing');
    expect(meta.tags.length).toBeGreaterThan(3);
  });

  it('includes a non-empty description', () => {
    const meta = buildVideoMetadata('Test Title');
    expect(meta.description.length).toBeGreaterThan(50);
  });
});

// ── uploadVideo ───────────────────────────────────────────────────────────────

describe('uploadVideo', () => {
  const mockFetch = jest.fn();
  const ACCESS_TOKEN = 'ya29.access-token';
  const UPLOAD_URL = 'https://resumable.upload.url/session/abc123';
  const VIDEO_ID = 'dQw4w9WgXcQ';

  const metadata = buildVideoMetadata('How Inflation Destroys Wealth');

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    (statSync as jest.Mock).mockReturnValue({ size: 1024 * 1024 });
    (readFileSync as jest.Mock).mockReturnValue(Buffer.from('fake-video-data'));
  });

  it('returns videoId and youtubeUrl on success', async () => {
    mockFetch
      .mockResolvedValueOnce(makeInitSessionResponse(UPLOAD_URL))
      .mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    const result = await uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN);

    expect(result.videoId).toBe(VIDEO_ID);
    expect(result.youtubeUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
  });

  it('creates the upload session with correct headers and metadata', async () => {
    mockFetch
      .mockResolvedValueOnce(makeInitSessionResponse(UPLOAD_URL))
      .mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN);

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('uploadType=resumable');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    expect((opts.headers as Record<string, string>)['X-Upload-Content-Type']).toBe('video/mp4');

    const body = JSON.parse(opts.body as string);
    expect(body.snippet.title).toBe('How Inflation Destroys Wealth');
    expect(body.status.privacyStatus).toBe('private');
  });

  it('uploads to the Location URL returned by the init session', async () => {
    mockFetch
      .mockResolvedValueOnce(makeInitSessionResponse(UPLOAD_URL))
      .mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN);

    const [uploadUrl] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(uploadUrl).toBe(UPLOAD_URL);
  });

  it('throws when the init session response has no Location header', async () => {
    const noLocationResponse: Response = {
      status: 200,
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
    } as unknown as Response;

    mockFetch.mockResolvedValueOnce(noLocationResponse);

    await expect(uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN)).rejects.toThrow(
      'YouTube upload session did not return a Location header',
    );
  });

  it('throws when the init session request fails', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(403, 'forbidden'));

    await expect(uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN)).rejects.toThrow(
      'YouTube upload session creation failed: 403. forbidden',
    );
  });

  it('throws when the file upload request fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeInitSessionResponse(UPLOAD_URL))
      .mockResolvedValueOnce(makeErrorResponse(500, 'internal error'));

    await expect(uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN)).rejects.toThrow(
      'YouTube video upload failed: 500. internal error',
    );
  });

  it('reads the file using fs.readFileSync', async () => {
    mockFetch
      .mockResolvedValueOnce(makeInitSessionResponse(UPLOAD_URL))
      .mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await uploadVideo('/path/to/video.mp4', metadata, ACCESS_TOKEN);

    expect(readFileSync).toHaveBeenCalledWith('/path/to/video.mp4');
  });
});

// ── publishVideo ──────────────────────────────────────────────────────────────

describe('publishVideo', () => {
  const mockFetch = jest.fn();
  const ACCESS_TOKEN = 'ya29.access-token';
  const VIDEO_ID = 'dQw4w9WgXcQ';

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('resolves without error on success', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await expect(publishVideo(VIDEO_ID, ACCESS_TOKEN)).resolves.toBeUndefined();
  });

  it('sends PUT to the videos endpoint with privacyStatus public', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await publishVideo(VIDEO_ID, ACCESS_TOKEN);

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('youtube/v3/videos');
    expect(opts.method).toBe('PUT');

    const body = JSON.parse(opts.body as string);
    expect(body.id).toBe(VIDEO_ID);
    expect(body.status.privacyStatus).toBe('public');
  });

  it('sends the Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ id: VIDEO_ID }));

    await publishVideo(VIDEO_ID, ACCESS_TOKEN);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });

  it('throws when the publish request fails', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(403, 'forbidden'));

    await expect(publishVideo(VIDEO_ID, ACCESS_TOKEN)).rejects.toThrow(
      'YouTube publish failed: 403. forbidden',
    );
  });
});
