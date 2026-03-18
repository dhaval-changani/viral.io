import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { VideoScene } from '../agents/schemas';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const MAX_RETRIES = 5;

export const AUDIO_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'audio');

// Exported for testability
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls ElevenLabs TTS API for a single text string and writes the audio to disk.
 * Implements exponential backoff on 429 responses:
 *   attempt 0 → wait 1 000 ms
 *   attempt 1 → wait 2 000 ms
 *   attempt 2 → wait 4 000 ms
 *   attempt 3 → wait 8 000 ms
 *   attempt 4 → wait 16 000 ms
 *   attempt 5 → throw (MAX_RETRIES exhausted)
 */
export async function generateTTSForText(text: string, outputPath: string): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${env.ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`ElevenLabs rate limit exceeded after ${MAX_RETRIES} retries`);
      }
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(
        `[ElevenLabs] Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `ElevenLabs API error: ${response.status} ${response.statusText}${body ? `. ${body}` : ''}`,
      );
    }

    const buffer = await response.arrayBuffer();
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(outputPath, Buffer.from(buffer));
    return;
  }
}

/**
 * Generates TTS audio files for all scenes in a script.
 * Files are saved to AUDIO_OUTPUT_DIR/{scriptRecordId}/scene_NNN.mp3.
 * Returns an array of public-path strings (one per scene, in scene order).
 */
export async function generateSceneAudio(
  scriptRecordId: string,
  scenes: Pick<VideoScene, 'spoken_script'>[],
): Promise<string[]> {
  const scriptDir = path.join(AUDIO_OUTPUT_DIR, scriptRecordId);
  const audioUrls: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const fileName = `scene_${String(i + 1).padStart(3, '0')}.mp3`;
    const outputPath = path.join(scriptDir, fileName);
    const publicPath = `/uploads/audio/${scriptRecordId}/${fileName}`;

    logger.info(`[ElevenLabs] Generating audio for scene ${i + 1}/${scenes.length}`);
    await generateTTSForText(scenes[i].spoken_script, outputPath);
    audioUrls.push(publicPath);
  }

  return audioUrls;
}
