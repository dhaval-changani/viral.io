import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CORS_ORIGIN: string;
  MONGODB_URI: string;
  // AI
  OPENAI_API_KEY: string;
  // ElevenLabs TTS
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  // Runway Gen-3 Alpha Turbo (B-roll)
  RUNWAY_API_KEY: string;
  // Epidemic Sound (music)
  EPIDEMIC_SOUND_API_KEY: string;
  // YouTube Data API v3 + OAuth2
  YOUTUBE_API_KEY: string;
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  YOUTUBE_REFRESH_TOKEN: string;
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePort(raw: string | undefined): number {
  const port = parseInt(raw ?? '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }
  return port;
}

const nodeEnv = (process.env.NODE_ENV ?? 'development') as EnvConfig['NODE_ENV'];

export const env: EnvConfig = {
  NODE_ENV: nodeEnv,
  PORT: parsePort(process.env.PORT),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  MONGODB_URI: requireEnv('MONGODB_URI'),
  // AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  // ElevenLabs TTS
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID ?? '',
  // Runway Gen-3 Alpha Turbo (B-roll)
  RUNWAY_API_KEY: process.env.RUNWAY_API_KEY ?? '',
  // Epidemic Sound (music)
  EPIDEMIC_SOUND_API_KEY: process.env.EPIDEMIC_SOUND_API_KEY ?? '',
  // YouTube Data API v3 + OAuth2
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY ?? '',
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? '',
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ?? '',
  YOUTUBE_REFRESH_TOKEN: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
  // JWT
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
};
