import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { IScriptRecord } from '../models/ScriptRecord';
import { logger } from '../utils/logger';
import type { SceneRenderProps, VideoRenderProps } from '../../remotion/src/types';

const execAsync = promisify(exec);

export const FPS = 30;
export const FALLBACK_COLOR = '#1a1a2e';
export const RENDERS_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'renders');
const REMOTION_DIR = path.resolve(process.cwd(), 'remotion');

/**
 * Resolves a public URL path (e.g. /uploads/audio/.../scene_001.mp3) to an
 * absolute filesystem path and returns it only if the file exists on disk.
 * Returns null when the asset is missing so callers can fall back gracefully.
 */
export function validateAssetPath(publicPath: string): string | null {
  // Strip leading slash then resolve relative to cwd (backend/)
  const relative = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
  const absolute = path.resolve(process.cwd(), relative);
  if (existsSync(absolute)) {
    return absolute;
  }
  logger.warn(`[Remotion] Asset not found on disk: ${absolute}`);
  return null;
}

/**
 * Builds the VideoRenderProps object consumed by the Remotion composition.
 * Validates every asset path; missing assets fall back to null so the
 * composition uses the CSS hex fallback colour instead.
 */
export function buildRenderProps(record: IScriptRecord): VideoRenderProps {
  const { result, audioUrls, brollUrls, musicTrack } = record;

  const scenes: SceneRenderProps[] = result.scenes.map((scene, i) => {
    const audioPublicPath = audioUrls[i] ?? null;
    const brollPublicPath = brollUrls[i] ?? null;

    const audioPath = audioPublicPath ? validateAssetPath(audioPublicPath) : null;
    const brollPath = brollPublicPath ? validateAssetPath(brollPublicPath) : null;

    return {
      sceneNumber: scene.scene_number,
      // Frame-accurate: multiply seconds by FPS
      durationInFrames: Math.round(scene.duration_seconds * FPS),
      visualDescription: scene.visual_description,
      spokenScript: scene.spoken_script,
      audioPath,
      brollPath,
      fallbackColor: FALLBACK_COLOR,
      onScreenText: scene.on_screen_text ?? null,
      transition: scene.transition ?? null,
    };
  });

  const musicPath =
    musicTrack?.previewUrl ? validateAssetPath(musicTrack.previewUrl) : null;

  return {
    fps: FPS,
    scenes,
    musicPath,
    videoTitle: result.video_title,
  };
}

/**
 * Renders a FullVideo composition via the Remotion CLI.
 * Emits the MP4 to uploads/renders/{scriptRecordId}/{renderJobId}.mp4.
 * Throws on render failure or if the output file is absent after the command.
 */
export async function renderVideo(
  scriptRecordId: string,
  renderJobId: string,
  record: IScriptRecord,
): Promise<string> {
  const outputDir = path.join(RENDERS_OUTPUT_DIR, scriptRecordId);
  mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${renderJobId}.mp4`);
  const props = buildRenderProps(record);
  const totalFrames = props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  logger.info(
    `[Remotion] Starting render — "${props.videoTitle}", ${props.scenes.length} scenes, ` +
    `${totalFrames} frames @ ${FPS}fps`,
  );

  // Serialize props as JSON; shell-escape single quotes for the --props flag
  const propsJson = JSON.stringify(props).replace(/'/g, "'\\''");

  const cmd = [
    'npx remotion render',
    'src/index.tsx',
    'FullVideo',
    `"${outputPath}"`,
    `--props='${propsJson}'`,
  ].join(' ');

  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: REMOTION_DIR });
    if (stdout) logger.debug(`[Remotion] stdout: ${stdout.trim()}`);
    if (stderr) logger.debug(`[Remotion] stderr: ${stderr.trim()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Remotion render process failed: ${message}`);
  }

  if (!existsSync(outputPath)) {
    throw new Error(`Remotion render completed but output file not found: ${outputPath}`);
  }

  logger.info(`[Remotion] Render complete → ${outputPath}`);
  return outputPath;
}
