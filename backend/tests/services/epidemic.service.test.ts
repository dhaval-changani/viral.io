// Mock env so the service doesn't crash on missing env vars
jest.mock('../../src/config/env', () => ({
  env: {
    EPIDEMIC_SOUND_API_KEY: 'test-epidemic-key',
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

import {
  searchTrackByMood,
  selectMusicForScript,
  sleep,
  type EpidemicTrack,
} from '../../src/services/epidemic.service';

// ── Helper response factories ─────────────────────────────────────────────────

function makeTrackResult(overrides: Partial<{ id: string; title: string; artistName: string; previewUrl: string }> = {}) {
  return {
    id: overrides.id ?? 'track-abc-123',
    title: overrides.title ?? 'Epic Finance',
    artistName: overrides.artistName ?? 'Studio Artist',
    previewUrl: overrides.previewUrl ?? 'https://cdn.epidemicsound.com/preview.mp3',
  };
}

function makeOkResponse(
  results: ReturnType<typeof makeTrackResult>[],
  rateLimitRemaining = 50,
): Response {
  return {
    status: 200,
    ok: true,
    headers: {
      get: (key: string) => (key === 'X-RateLimit-Remaining' ? String(rateLimitRemaining) : null),
    },
    json: jest.fn().mockResolvedValue({ results }),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function makeErrorResponse(status: number, statusText: string, body = ''): Response {
  return {
    status,
    ok: false,
    statusText,
    headers: {
      get: () => null,
    },
    json: jest.fn(),
    text: jest.fn().mockResolvedValue(body),
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

// ── searchTrackByMood ─────────────────────────────────────────────────────────

describe('searchTrackByMood', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it('calls Epidemic Sound API with mood query param and Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    await searchTrackByMood('uplifting');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('mood=uplifting');
    expect(url).toContain('limit=1');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-epidemic-key',
    );
  });

  it('returns a correctly shaped EpidemicTrack on success', async () => {
    const track = makeTrackResult({ id: 't1', title: 'Rising Markets', artistName: 'DJ Wealth' });
    mockFetch.mockResolvedValueOnce(makeOkResponse([track]));

    const result: EpidemicTrack = await searchTrackByMood('inspiring');

    expect(result).toEqual({
      trackId: 't1',
      title: 'Rising Markets',
      artistName: 'DJ Wealth',
      previewUrl: track.previewUrl,
      mood: 'inspiring',
    });
  });

  it('throws when results array is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));

    await expect(searchTrackByMood('tense')).rejects.toThrow('No tracks found for mood: tense');
  });

  it('throws immediately on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error', 'upstream fail'));

    await expect(searchTrackByMood('calm')).rejects.toThrow(
      'Epidemic Sound API error: 500 Internal Server Error. upstream fail',
    );
  });

  it('throws on 401 Unauthorized', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'));

    await expect(searchTrackByMood('dramatic')).rejects.toThrow(
      'Epidemic Sound API error: 401 Unauthorized',
    );
  });

  it('does NOT delay when X-RateLimit-Remaining >= 10', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()], 15));

    await searchTrackByMood('neutral');

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('delays 60s when X-RateLimit-Remaining < 10', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()], 9));

    const promise = searchTrackByMood('urgent');
    await jest.advanceTimersByTimeAsync(60_000);
    await promise;

    jest.useRealTimers();
  });

  it('delays when X-RateLimit-Remaining is exactly 9 (boundary)', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()], 9));

    const promise = searchTrackByMood('suspenseful');
    await jest.advanceTimersByTimeAsync(60_000);
    await promise;

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
    expect(delays).toContain(60_000);
    jest.useRealTimers();
  });

  it('does NOT delay when X-RateLimit-Remaining is exactly 10 (boundary)', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()], 10));

    await searchTrackByMood('calm');

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('handles missing X-RateLimit-Remaining header without delaying', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const responseWithNoHeader = {
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: jest.fn().mockResolvedValue({ results: [makeTrackResult()] }),
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(responseWithNoHeader);

    await searchTrackByMood('neutral');

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('URL-encodes the mood parameter', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    await searchTrackByMood('calm');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('mood=calm');
  });
});

// ── selectMusicForScript ──────────────────────────────────────────────────────

describe('selectMusicForScript', () => {
  const SCRIPT_ID = '507f1f77bcf86cd799439011';

  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it('throws when no scenes are provided', async () => {
    await expect(selectMusicForScript(SCRIPT_ID, [])).rejects.toThrow(
      'No scenes provided for music selection',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('searches for the dominant mood across scenes', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    const scenes = [
      { background_music_mood: 'uplifting' as const },
      { background_music_mood: 'uplifting' as const },
      { background_music_mood: 'tense' as const },
    ];

    await selectMusicForScript(SCRIPT_ID, scenes);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('mood=uplifting');
  });

  it('returns the track from the dominant mood search', async () => {
    const track = makeTrackResult({ id: 'dominant-track', title: 'Wealth Builder' });
    mockFetch.mockResolvedValueOnce(makeOkResponse([track]));

    const scenes = [
      { background_music_mood: 'inspiring' as const },
      { background_music_mood: 'inspiring' as const },
      { background_music_mood: 'calm' as const },
    ];

    const result = await selectMusicForScript(SCRIPT_ID, scenes);

    expect(result.trackId).toBe('dominant-track');
    expect(result.title).toBe('Wealth Builder');
    expect(result.mood).toBe('inspiring');
  });

  it('makes exactly one API call regardless of scene count', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    const scenes = Array.from({ length: 20 }, () => ({
      background_music_mood: 'dramatic' as const,
    }));

    await selectMusicForScript(SCRIPT_ID, scenes);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('picks the most frequent mood when there is a clear winner', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    const scenes = [
      { background_music_mood: 'tense' as const },
      { background_music_mood: 'tense' as const },
      { background_music_mood: 'tense' as const },
      { background_music_mood: 'calm' as const },
      { background_music_mood: 'uplifting' as const },
    ];

    await selectMusicForScript(SCRIPT_ID, scenes);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('mood=tense');
  });

  it('works with a single scene', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTrackResult()]));

    const result = await selectMusicForScript(SCRIPT_ID, [
      { background_music_mood: 'urgent' as const },
    ]);

    expect(result.mood).toBe('urgent');
  });

  it('propagates errors from searchTrackByMood', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Server Error'));

    await expect(
      selectMusicForScript(SCRIPT_ID, [{ background_music_mood: 'calm' as const }]),
    ).rejects.toThrow('Epidemic Sound API error: 500 Server Error');
  });
});
