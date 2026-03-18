import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { VideoScene } from '../agents/schemas';

const EPIDEMIC_API_BASE = 'https://api.epidemicsound.com/v2';
const RATE_LIMIT_THRESHOLD = 10;
const RATE_LIMIT_DELAY_MS = 60_000;

export interface EpidemicTrack {
  trackId: string;
  title: string;
  artistName: string;
  previewUrl: string;
  mood: string;
}

interface EpidemicSearchResult {
  id: string;
  title: string;
  artistName: string;
  previewUrl: string;
}

interface EpidemicSearchResponse {
  results: EpidemicSearchResult[];
}

// Exported for testability
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function epidemicHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.EPIDEMIC_SOUND_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Reads the X-RateLimit-Remaining header from a response.
 * If remaining < RATE_LIMIT_THRESHOLD, logs a warning and sleeps
 * RATE_LIMIT_DELAY_MS ms before resuming — this throttles the caller
 * so subsequent requests don't exhaust the quota.
 */
async function checkRateLimit(response: Response): Promise<void> {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') ?? '100', 10);
  if (remaining < RATE_LIMIT_THRESHOLD) {
    logger.warn(
      `[EpidemicSound] Rate limit low: ${remaining} remaining. Delaying ${RATE_LIMIT_DELAY_MS}ms`,
    );
    await sleep(RATE_LIMIT_DELAY_MS);
  }
}

/**
 * Searches Epidemic Sound for a track matching the given mood.
 * Monitors X-RateLimit-Remaining; delays if remaining < 10.
 * Returns the first matching track.
 */
export async function searchTrackByMood(mood: string): Promise<EpidemicTrack> {
  const url = `${EPIDEMIC_API_BASE}/tracks/search?mood=${encodeURIComponent(mood)}&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: epidemicHeaders(),
  });

  await checkRateLimit(response);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Epidemic Sound API error: ${response.status} ${response.statusText}${body ? `. ${body}` : ''}`,
    );
  }

  const data = (await response.json()) as EpidemicSearchResponse;

  if (!data.results || data.results.length === 0) {
    throw new Error(`No tracks found for mood: ${mood}`);
  }

  const hit = data.results[0];
  return {
    trackId: hit.id,
    title: hit.title,
    artistName: hit.artistName,
    previewUrl: hit.previewUrl,
    mood,
  };
}

/**
 * Selects a single background music track for the entire script by finding
 * the dominant mood across all scenes and searching Epidemic Sound for it.
 * Returns one EpidemicTrack to be stored on the ScriptRecord.
 */
export async function selectMusicForScript(
  scriptRecordId: string,
  scenes: Pick<VideoScene, 'background_music_mood'>[],
): Promise<EpidemicTrack> {
  if (scenes.length === 0) {
    throw new Error('No scenes provided for music selection');
  }

  // Tally moods and pick the most frequent one
  const moodCounts = new Map<string, number>();
  for (const scene of scenes) {
    moodCounts.set(
      scene.background_music_mood,
      (moodCounts.get(scene.background_music_mood) ?? 0) + 1,
    );
  }

  const dominantMood = [...moodCounts.entries()].sort(([, a], [, b]) => b - a)[0][0];

  logger.info(
    `[EpidemicSound] Selecting music for ScriptRecord ${scriptRecordId} — dominant mood: ${dominantMood}`,
  );

  return searchTrackByMood(dominantMood);
}
