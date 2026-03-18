# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated AI-powered finance YouTube video generation system. The backend exposes an Express.js REST API that drives a pipeline: **idea generation → script generation → (planned) asset synthesis → Remotion render → YouTube upload**.

## Stack

- **Runtime:** Node.js v22+ / TypeScript (strict mode)
- **Backend:** Express 5 + MongoDB (Mongoose) + JWT auth
- **LLM:** Vercel AI SDK (`ai` + `@ai-sdk/openai`) with GPT-4o Structured Outputs via Zod
- **Planned assets:** ElevenLabs (TTS), Runway Gen-3 Alpha Turbo (B-roll), Epidemic Sound (music), Remotion (render)

## Commands (run from `backend/`)

```bash
npm run dev          # tsx watch — hot reload
npm run build        # tsc -p tsconfig.build.json → dist/
npm run start        # node dist/server.js
npm run test         # jest (all tests in tests/)
npm run test:watch   # jest --watch
npm run test:coverage # jest --coverage (70% threshold)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/ tests/
npm run lint:fix     # eslint --fix
npm run format       # prettier --write
```

Run a single test file:
```bash
npx jest tests/agents/ViralIdeationModule.test.ts
```

## Architecture

### Request flow
```
Express (app.ts) → /api/v1 router (routes/index.ts)
  → /health, /auth, /users, /ideation, /script
  → Controller → Agent module (generateObject) → JSON response
```

### AI Agent pipeline
All AI calls use `generateObject` with Zod schemas — never `generateText`. Schemas live in `src/agents/schemas.ts`.

1. **Ideation** (`ViralIdeationModule.ts`) — takes a finance topic, returns 3–10 `ViralVideo` objects with title, thumbnail concept, hook script, primal desire, estimated RPM, and content gap analysis.
2. **Script** (`ScriptGenerationModule.ts`) — takes a `ViralVideo`, returns a `FullVideoScript` with 20–60 scenes, each mapping to ElevenLabs TTS, Runway b-roll prompt, and Remotion compositor fields.

### Key schema contracts (`src/agents/schemas.ts`)
- `IdeationResponseSchema` → output of ideation module
- `FullVideoScriptSchema` → render-ready script; scenes must sum to `total_duration_seconds ± 5s`; first `chapter_markers` entry must be at `timestamp_seconds: 0`
- `VideoSceneSchema` — each scene has `spoken_script` (ElevenLabs), `b_roll_prompt` (Runway), `visual_description` (Remotion), `background_music_mood` (Epidemic Sound)

### Backend structure
```
backend/src/
  agents/          # ViralIdeationModule, ScriptGenerationModule, schemas
  config/          # env.ts (validated at startup), database.ts (Mongoose)
  controllers/     # thin — delegates to agents/services
  middleware/      # errorHandler, validate (Zod), requestLogger, notFound
  models/          # User.ts (Mongoose)
  routes/          # index.ts wires /health /auth /users /ideation /script
  schemas/         # Zod request validation (auth.schema, user.schema)
  services/        # user.service.ts
  types/           # shared TypeScript types
  utils/           # logger.ts (Winston/console)
```

## Environment Variables

All required; validated at startup by `src/config/env.ts` — the server throws on any missing key:

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=
MONGODB_URI=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
RUNWAY_API_KEY=
EPIDEMIC_SOUND_API_KEY=
YOUTUBE_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
JWT_SECRET=
JWT_EXPIRES_IN=
```

Copy `backend/.env.example` to `backend/.env` before running.

## Critical Rules

- **Always `generateObject`, never `generateText`** — all AI outputs must be Zod-validated structured objects.
- **ElevenLabs 429s** — exponential backoff (5 retries, `2^i * 1000ms` delay).
- **Remotion renders** — verify every asset path exists (`existsSync`); fall back to a CSS hex color string on failure.
- **Epidemic Sound** — check `X-RateLimit-Remaining` header; delay if `< 10`.
- **Upload cadence** — 1 video at a time, manual review before any YouTube publish call.
- **Locale** — target Tier-1 (US/UK/CA/AU); use `$` (USD) by default.
- **Script targets** — 8–15 min videos (480–900s), 20+ scenes, estimated RPM $10–$25.

## TypeScript Conventions

- Strict mode enabled (`"strict": true` in tsconfig)
- Use `interface` for object shapes, `type` for unions/primitives
- Always define explicit return types on exported functions
- Path alias `@/` maps to `src/` (configured in jest and tsconfig)
