// Mock env before importing the service
jest.mock('../../src/config/env', () => ({
  env: {
    RUNWAY_API_KEY: 'test-runway-key',
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
  submitBRollJob,
  pollBRollJob,
  generateSceneBRoll,
  sleep,
} from '../../src/services/runway.service';

// ── Helper response factories ─────────────────────────────────────────────────

function makeSubmitResponse(id = 'job-abc-123'): Response {
  return {
    status: 200,
    ok: true,
    json: jest.fn().mockResolvedValue({ id }),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function makePollResponse(
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED',
  output: string[] | null = null,
  failure?: string,
): Response {
  return {
    status: 200,
    ok: true,
    json: jest.fn().mockResolvedValue({ id: 'job-abc-123', status, output, failure }),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function makeErrorResponse(status: number, statusText: string, body = ''): Response {
  return {
    status,
    ok: false,
    statusText,
    json: jest.fn().mockRejectedValue(new Error('not json')),
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

// ── submitBRollJob ────────────────────────────────────────────────────────────

describe('submitBRollJob', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls Runway API with correct endpoint, headers, and body', async () => {
    mockFetch.mockResolvedValueOnce(makeSubmitResponse('job-123'));

    await submitBRollJob('Close-up of stock chart crashing, slow motion.');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/text_to_video');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-runway-key',
    );
    expect((init.headers as Record<string, string>)['X-Runway-Version']).toBeDefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gen3a_turbo');
    expect(body.promptText).toBe('Close-up of stock chart crashing, slow motion.');
    expect(body.duration).toBeDefined();
    expect(body.ratio).toBeDefined();
  });

  it('returns the job ID from the API response', async () => {
    mockFetch.mockResolvedValueOnce(makeSubmitResponse('job-xyz-789'));

    const jobId = await submitBRollJob('Some prompt');

    expect(jobId).toBe('job-xyz-789');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized', 'Invalid API key'));

    await expect(submitBRollJob('Some prompt')).rejects.toThrow(
      'Runway submit error: 401 Unauthorized. Invalid API key',
    );
  });

  it('throws on 500 server error', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error'));

    await expect(submitBRollJob('Some prompt')).rejects.toThrow(
      'Runway submit error: 500 Internal Server Error',
    );
  });
});

// ── pollBRollJob ──────────────────────────────────────────────────────────────

describe('pollBRollJob', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns the video URL when job succeeds on first poll', async () => {
    mockFetch.mockResolvedValueOnce(
      makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/video.mp4']),
    );

    const url = await pollBRollJob('job-123');

    expect(url).toBe('https://cdn.runway.ml/video.mp4');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('polls correct endpoint with correct headers', async () => {
    mockFetch.mockResolvedValueOnce(
      makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/video.mp4']),
    );

    await pollBRollJob('job-abc-123');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tasks/job-abc-123');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-runway-key',
    );
    expect(init.method).toBe('GET');
  });

  it('waits and retries when job is PENDING, then returns URL on SUCCEEDED', async () => {
    mockFetch
      .mockResolvedValueOnce(makePollResponse('PENDING'))
      .mockResolvedValueOnce(makePollResponse('RUNNING'))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/video.mp4']));

    const promise = pollBRollJob('job-123');
    // Advance past the first two sleeps
    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);
    const url = await promise;

    expect(url).toBe('https://cdn.runway.ml/video.mp4');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws when job FAILED', async () => {
    mockFetch.mockResolvedValueOnce(makePollResponse('FAILED', null, 'content policy violation'));

    const promise = pollBRollJob('job-123');
    await expect(promise).rejects.toThrow('Runway job job-123 failed: content policy violation');
  });

  it('throws with fallback message when FAILED with no failure field', async () => {
    mockFetch.mockResolvedValueOnce(makePollResponse('FAILED', null, undefined));

    await expect(pollBRollJob('job-123')).rejects.toThrow(
      'Runway job job-123 failed: unknown reason',
    );
  });

  it('throws when SUCCEEDED but output is empty', async () => {
    mockFetch.mockResolvedValueOnce(makePollResponse('SUCCEEDED', []));

    await expect(pollBRollJob('job-123')).rejects.toThrow(
      'Runway job job-123 succeeded but returned no output',
    );
  });

  it('throws when SUCCEEDED but output is null', async () => {
    mockFetch.mockResolvedValueOnce(makePollResponse('SUCCEEDED', null));

    await expect(pollBRollJob('job-123')).rejects.toThrow(
      'Runway job job-123 succeeded but returned no output',
    );
  });

  it('throws after max poll attempts are exhausted', async () => {
    // Always return RUNNING
    mockFetch.mockResolvedValue(makePollResponse('RUNNING'));

    const promise = pollBRollJob('job-123');
    promise.catch(() => {});

    // Advance through all 30 poll intervals
    for (let i = 0; i < 30; i++) {
      await jest.advanceTimersByTimeAsync(5000);
    }

    await expect(promise).rejects.toThrow('Runway job job-123 timed out after 30 poll attempts');
  });

  it('throws on non-OK poll response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Server Error', 'downstream failure'));

    const promise = pollBRollJob('job-123');
    await expect(promise).rejects.toThrow(
      'Runway poll error: 500 Server Error. downstream failure',
    );
  });
});

// ── generateSceneBRoll ────────────────────────────────────────────────────────

describe('generateSceneBRoll', () => {
  const SCRIPT_ID = '507f1f77bcf86cd799439011';
  const SCENES = [
    { b_roll_prompt: 'Close-up of stock chart crashing, slow motion.' },
    { b_roll_prompt: 'Hands counting cash on a wooden desk, overhead shot.' },
    { b_roll_prompt: 'Person celebrating in front of laptop screen, wide shot.' },
  ];

  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty array when given no scenes', async () => {
    const urls = await generateSceneBRoll(SCRIPT_ID, []);
    expect(urls).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('submits one job per scene and returns one URL per scene', async () => {
    const fakeUrls = [
      'https://cdn.runway.ml/scene1.mp4',
      'https://cdn.runway.ml/scene2.mp4',
      'https://cdn.runway.ml/scene3.mp4',
    ];

    // 3 submit calls + 3 poll calls
    mockFetch
      .mockResolvedValueOnce(makeSubmitResponse('job-1'))
      .mockResolvedValueOnce(makeSubmitResponse('job-2'))
      .mockResolvedValueOnce(makeSubmitResponse('job-3'))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', [fakeUrls[0]]))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', [fakeUrls[1]]))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', [fakeUrls[2]]));

    const urls = await generateSceneBRoll(SCRIPT_ID, SCENES);

    expect(urls).toEqual(fakeUrls);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('passes each scene b_roll_prompt to Runway submit', async () => {
    mockFetch
      .mockResolvedValueOnce(makeSubmitResponse('job-1'))
      .mockResolvedValueOnce(makeSubmitResponse('job-2'))
      .mockResolvedValueOnce(makeSubmitResponse('job-3'))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/1.mp4']))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/2.mp4']))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/3.mp4']));

    await generateSceneBRoll(SCRIPT_ID, SCENES);

    // First 3 calls are submit calls
    const submitBodies = mockFetch.mock.calls
      .slice(0, 3)
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));

    expect(submitBodies[0].promptText).toBe(SCENES[0].b_roll_prompt);
    expect(submitBodies[1].promptText).toBe(SCENES[1].b_roll_prompt);
    expect(submitBodies[2].promptText).toBe(SCENES[2].b_roll_prompt);
  });

  it('propagates errors from submitBRollJob', async () => {
    mockFetch
      .mockResolvedValueOnce(makeSubmitResponse('job-1'))
      .mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(makeSubmitResponse('job-3'));

    await expect(generateSceneBRoll(SCRIPT_ID, SCENES)).rejects.toThrow(
      'Runway submit error: 401 Unauthorized',
    );
  });

  it('propagates errors from pollBRollJob', async () => {
    mockFetch
      .mockResolvedValueOnce(makeSubmitResponse('job-1'))
      .mockResolvedValueOnce(makeSubmitResponse('job-2'))
      .mockResolvedValueOnce(makeSubmitResponse('job-3'))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/1.mp4']))
      .mockResolvedValueOnce(makePollResponse('FAILED', null, 'safety violation'))
      .mockResolvedValueOnce(makePollResponse('SUCCEEDED', ['https://cdn.runway.ml/3.mp4']));

    await expect(generateSceneBRoll(SCRIPT_ID, SCENES)).rejects.toThrow(
      'Runway job job-2 failed: safety violation',
    );
  });
});
