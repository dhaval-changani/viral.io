import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos';

export interface YouTubeUploadResult {
  videoId: string;
  youtubeUrl: string;
}

export interface YouTubeVideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
}

// Exported for testability
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a fresh OAuth2 access token using the stored refresh token.
 */
export async function refreshAccessToken(): Promise<string> {
  const response = await fetch(OAUTH2_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `YouTube OAuth2 token refresh failed: ${response.status}${body ? `. ${body}` : ''}`,
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Builds SEO-enriched metadata for a Finance YouTube video.
 * Category 27 = Education; targets Tier-1 audience (US/UK/CA/AU).
 */
export function buildVideoMetadata(title: string): YouTubeVideoMetadata {
  const description = [
    title,
    '',
    'In this video, we break down key financial concepts that affect your wealth-building journey.',
    '',
    '📊 What you will learn:',
    `• ${title}`,
    '',
    '💡 Subscribe for weekly finance education covering investing, inflation, and building lasting wealth.',
    '',
    '#PersonalFinance #FinancialEducation #WealthBuilding #Investing #MoneyTips',
  ].join('\n');

  return {
    title,
    description,
    tags: [
      'personal finance',
      'financial education',
      'wealth building',
      'investing',
      'money management',
      'finance tips',
      'financial literacy',
    ],
    categoryId: '27', // Education
  };
}

/**
 * Creates a resumable YouTube upload session and uploads the video file.
 * The video is created as 'private' — use publishVideo() to make it public.
 * Returns the YouTube video ID and watch URL.
 */
export async function uploadVideo(
  filePath: string,
  metadata: YouTubeVideoMetadata,
  accessToken: string,
): Promise<YouTubeUploadResult> {
  logger.info(`[YouTube] Starting upload for: ${metadata.title}`);

  const fileSize = fs.statSync(filePath).size;

  // Step 1: Create resumable upload session
  const initResponse = await fetch(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId,
          defaultLanguage: 'en',
        },
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );

  if (!initResponse.ok) {
    const body = await initResponse.text().catch(() => '');
    throw new Error(
      `YouTube upload session creation failed: ${initResponse.status}${body ? `. ${body}` : ''}`,
    );
  }

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('YouTube upload session did not return a Location header');
  }

  logger.info(`[YouTube] Resumable upload session created, uploading ${fileSize} bytes`);

  // Step 2: Upload the file
  const fileBuffer = fs.readFileSync(filePath);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text().catch(() => '');
    throw new Error(
      `YouTube video upload failed: ${uploadResponse.status}${body ? `. ${body}` : ''}`,
    );
  }

  const data = (await uploadResponse.json()) as { id: string };
  const videoId = data.id;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  logger.info(`[YouTube] Upload complete: ${youtubeUrl}`);

  return { videoId, youtubeUrl };
}

/**
 * Sets a YouTube video's privacy status to 'public'.
 * This is the manual review gate — call only after explicit user approval.
 */
export async function publishVideo(videoId: string, accessToken: string): Promise<void> {
  logger.info(`[YouTube] Publishing video ${videoId}`);

  const response = await fetch(`${YOUTUBE_API_URL}?part=status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: videoId,
      status: {
        privacyStatus: 'public',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`YouTube publish failed: ${response.status}${body ? `. ${body}` : ''}`);
  }

  logger.info(`[YouTube] Video ${videoId} is now public`);
}
