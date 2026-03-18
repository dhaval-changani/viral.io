import path from 'path';

// Mock fs/promises before importing the service
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
}));

// Mock env so the service doesn't crash on missing env vars
jest.mock('../../src/config/env', () => ({
  env: {
    ELEVENLABS_API_KEY: 'test-api-key',
    ELEVENLABS_VOICE_ID: 'test-voice-id',
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

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
  generateTTSForText,
  generateSceneAudio,
  AUDIO_OUTPUT_DIR,
  sleep,
} from '../../src/services/elevenlabs.service';

// ── Helper response factories ─────────────────────────────────────────────────

function makeOkResponse(body: ArrayBuffer = new ArrayBuffer(100)): Response {
  return {
    status: 200,
    ok: true,
    arrayBuffer: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function make429Response(): Response {
  return {
    status: 429,
    ok: false,
    text: jest.fn().mockResolvedValue('rate limited'),
  } as unknown as Response;
}

function makeErrorResponse(status: number, statusText: string, body = ''): Response {
  return {
    status,
    ok: false,
    statusText,
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ── sleep ─────────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    jest.useFakeTimers();
    const promise = sleep(1000);
    jest.advanceTimersByTime(1000);
    await promise;
    jest.useRealTimers();
  });
});

// ── generateTTSForText ────────────────────────────────────────────────────────

describe('generateTTSForText', () => {
  const OUTPUT_PATH = '/tmp/test_audio/scene_001.mp3';

  // Re-spy on fetch before every test so restoreMocks doesn't break subsequent tests
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
    (existsSync as jest.Mock).mockReturnValue(false);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('calls ElevenLabs API with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse());

    await generateTTSForText('Hello world', OUTPUT_PATH);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/text-to-speech/test-voice-id');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('test-api-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('audio/mpeg');
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: 'Hello world',
      model_id: 'eleven_turbo_v2',
    });
  });

  it('writes audio buffer to the output path', async () => {
    const fakeAudio = new ArrayBuffer(256);
    mockFetch.mockResolvedValueOnce(makeOkResponse(fakeAudio));

    await generateTTSForText('Narration text', OUTPUT_PATH);

    expect(mkdir).toHaveBeenCalledWith(path.dirname(OUTPUT_PATH), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(OUTPUT_PATH, Buffer.from(fakeAudio));
  });

  it('skips mkdir when directory already exists', async () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(makeOkResponse());

    await generateTTSForText('Text', OUTPUT_PATH);

    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on the next attempt', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValueOnce(make429Response()).mockResolvedValueOnce(makeOkResponse());

    const promise = generateTTSForText('Text', OUTPUT_PATH);
    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('retries up to MAX_RETRIES (5) times on consecutive 429s', async () => {
    jest.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(makeOkResponse());

    const promise = generateTTSForText('Text', OUTPUT_PATH);
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(writeFile).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('throws after MAX_RETRIES (5) exhausted with all 429s', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue(make429Response());

    const promise = generateTTSForText('Text', OUTPUT_PATH);
    // Suppress unhandled-rejection noise while advancing fake timers
    promise.catch(() => {});
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);
    await expect(promise).rejects.toThrow('ElevenLabs rate limit exceeded after 5 retries');
    // initial + 5 retries; attempt 5 throws without sleeping
    expect(mockFetch).toHaveBeenCalledTimes(6);

    jest.useRealTimers();
  });

  it('uses exponential backoff delays: 1s, 2s, 4s, 8s, 16s', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    mockFetch
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(make429Response())
      .mockResolvedValueOnce(makeOkResponse());

    const promise = generateTTSForText('Text', OUTPUT_PATH);
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);
    await promise;

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);

    jest.useRealTimers();
  });

  it('throws immediately on non-429 API errors without retrying', async () => {
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse(500, 'Internal Server Error', 'upstream fail'),
    );

    await expect(generateTTSForText('Text', OUTPUT_PATH)).rejects.toThrow(
      'ElevenLabs API error: 500 Internal Server Error. upstream fail',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on 401 Unauthorized without retrying', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'));

    await expect(generateTTSForText('Text', OUTPUT_PATH)).rejects.toThrow(
      'ElevenLabs API error: 401 Unauthorized',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── generateSceneAudio ────────────────────────────────────────────────────────

describe('generateSceneAudio', () => {
  const SCRIPT_ID = '507f1f77bcf86cd799439011';
  const SCENES = [
    { spoken_script: 'Scene one narration text here.' },
    { spoken_script: 'Scene two narration text here.' },
    { spoken_script: 'Scene three narration text here.' },
  ];

  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
    (existsSync as jest.Mock).mockReturnValue(true);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    mockFetch.mockResolvedValue(makeOkResponse());
  });

  it('generates one audio file per scene', async () => {
    const urls = await generateSceneAudio(SCRIPT_ID, SCENES);

    expect(urls).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(writeFile).toHaveBeenCalledTimes(3);
  });

  it('returns public URL paths with correct format', async () => {
    const urls = await generateSceneAudio(SCRIPT_ID, SCENES);

    expect(urls[0]).toBe(`/uploads/audio/${SCRIPT_ID}/scene_001.mp3`);
    expect(urls[1]).toBe(`/uploads/audio/${SCRIPT_ID}/scene_002.mp3`);
    expect(urls[2]).toBe(`/uploads/audio/${SCRIPT_ID}/scene_003.mp3`);
  });

  it('writes files to correct paths under AUDIO_OUTPUT_DIR', async () => {
    await generateSceneAudio(SCRIPT_ID, SCENES);

    const expectedDir = path.join(AUDIO_OUTPUT_DIR, SCRIPT_ID);
    expect(writeFile).toHaveBeenCalledWith(
      path.join(expectedDir, 'scene_001.mp3'),
      expect.any(Buffer),
    );
    expect(writeFile).toHaveBeenCalledWith(
      path.join(expectedDir, 'scene_002.mp3'),
      expect.any(Buffer),
    );
  });

  it('passes each scene spoken_script as the TTS text', async () => {
    await generateSceneAudio(SCRIPT_ID, SCENES);

    const bodies = mockFetch.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string),
    );
    expect(bodies[0].text).toBe(SCENES[0].spoken_script);
    expect(bodies[1].text).toBe(SCENES[1].spoken_script);
    expect(bodies[2].text).toBe(SCENES[2].spoken_script);
  });

  it('returns an empty array when given no scenes', async () => {
    const urls = await generateSceneAudio(SCRIPT_ID, []);
    expect(urls).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates errors from generateTTSForText', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse())
      .mockResolvedValueOnce(makeErrorResponse(500, 'Server Error'));

    await expect(generateSceneAudio(SCRIPT_ID, SCENES)).rejects.toThrow(
      'ElevenLabs API error: 500 Server Error',
    );
    // First scene succeeds, second throws
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});
