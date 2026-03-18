import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { VideoScene } from '../agents/schemas';

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_API_VERSION = '2024-11-06';
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 5000;

type RunwayJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

interface RunwaySubmitResponse {
  id: string;
}

interface RunwayTaskResponse {
  id: string;
  status: RunwayJobStatus;
  output: string[] | null;
  failure?: string;
}

// Exported for testability
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runwayHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.RUNWAY_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': RUNWAY_API_VERSION,
  };
}

/**
 * Submits a single b-roll generation job to Runway Gen-3 Alpha Turbo.
 * Returns the Runway task ID for polling.
 */
export async function submitBRollJob(prompt: string): Promise<string> {
  const response = await fetch(`${RUNWAY_API_BASE}/text_to_video`, {
    method: 'POST',
    headers: runwayHeaders(),
    body: JSON.stringify({
      model: 'gen3a_turbo',
      promptText: prompt,
      duration: 5,
      ratio: '1280:720',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Runway submit error: ${response.status} ${response.statusText}${body ? `. ${body}` : ''}`,
    );
  }

  const data = (await response.json()) as RunwaySubmitResponse;
  return data.id;
}

/**
 * Polls a Runway task until it reaches SUCCEEDED or FAILED status.
 * Polls every POLL_INTERVAL_MS ms for up to MAX_POLL_ATTEMPTS attempts.
 * Returns the first output URL on success.
 */
export async function pollBRollJob(jobId: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(`${RUNWAY_API_BASE}/tasks/${jobId}`, {
      method: 'GET',
      headers: runwayHeaders(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Runway poll error: ${response.status} ${response.statusText}${body ? `. ${body}` : ''}`,
      );
    }

    const task = (await response.json()) as RunwayTaskResponse;

    if (task.status === 'SUCCEEDED') {
      if (!task.output || task.output.length === 0) {
        throw new Error(`Runway job ${jobId} succeeded but returned no output`);
      }
      return task.output[0];
    }

    if (task.status === 'FAILED') {
      throw new Error(`Runway job ${jobId} failed: ${task.failure ?? 'unknown reason'}`);
    }

    logger.info(
      `[Runway] Job ${jobId} status: ${task.status} (attempt ${attempt}/${MAX_POLL_ATTEMPTS})`,
    );

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(`Runway job ${jobId} timed out after ${MAX_POLL_ATTEMPTS} poll attempts`);
}

/**
 * Generates b-roll video URLs for all scenes in parallel.
 * Submits all Runway jobs at once, then polls all in parallel.
 * Returns an array of video URLs in scene order.
 */
export async function generateSceneBRoll(
  scriptRecordId: string,
  scenes: Pick<VideoScene, 'b_roll_prompt'>[],
): Promise<string[]> {
  if (scenes.length === 0) return [];

  logger.info(
    `[Runway] Submitting ${scenes.length} b-roll jobs for ScriptRecord ${scriptRecordId}`,
  );

  const jobIds = await Promise.all(
    scenes.map((scene, i) => {
      logger.info(`[Runway] Submitting b-roll job for scene ${i + 1}/${scenes.length}`);
      return submitBRollJob(scene.b_roll_prompt);
    }),
  );

  logger.info(`[Runway] All ${jobIds.length} jobs submitted. Polling for completion...`);

  const videoUrls = await Promise.all(
    jobIds.map((jobId, i) => {
      logger.info(`[Runway] Polling job ${jobId} for scene ${i + 1}`);
      return pollBRollJob(jobId);
    }),
  );

  logger.info(
    `[Runway] B-roll generation complete for ScriptRecord ${scriptRecordId}: ${videoUrls.length} videos`,
  );

  return videoUrls;
}
