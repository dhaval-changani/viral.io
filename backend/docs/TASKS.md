# TASKS.md

Tracks all pending work for the viral.io backend pipeline.

---

## 🔴 Critical Bugs (Fix First)

- [x] **`auth.controller.ts:12`** — Fix `jwt.sign()` TypeScript overload mismatch (`expiresIn` in options object)
- [x] **`models/User.ts:45`** — Fix `delete ret.passwordHash` error; mark `passwordHash` as optional in the toJSON transform return type
- [x] **`tests/agents/ViralIdeationModule.test.ts:83`** — Remove `maxTokens` from `generateViralIdeas()` call (not in function signature)
- [x] **Debug `console.log` cleanup** — Replace 6 instances with `logger.debug()`:
  - `src/middleware/validate.ts` (lines 24, 31)
  - `src/controllers/ideation.controller.ts` (line 32)
  - `src/controllers/user.controller.ts` (lines 27, 29)

---

## 🟠 Auth & Security

- [x] Create JWT verification middleware (`src/middleware/auth.ts`)
- [x] Protect `/ideation/*` and `/script/*` routes with JWT middleware
- [x] Add user signup endpoint (`POST /api/v1/auth/register`)
- [x] Add role-based access control (RBAC) skeleton for future admin vs. user roles
- [x] Add per-user rate limiting on AI generation endpoints

---

## 🟠 Data Persistence

- [x] Create `IdeaRecord` Mongoose model — stores generated ideas linked to user + timestamp
- [x] Create `ScriptRecord` Mongoose model — stores generated scripts linked to `IdeaRecord`
- [x] Create `RenderJob` Mongoose model — tracks render/upload job status
- [x] Add save-to-DB logic in `ideation.controller.ts` after successful generation
- [x] Add save-to-DB logic in `script.controller.ts` after successful generation
- [x] Add history endpoints: `GET /ideation/history`, `GET /script/history`


---

## 🟡 Stage 3 — Asset Generation (In Progress)

### ElevenLabs TTS
- [x] Create `ElevenLabsService` (`src/services/elevenlabs.service.ts`)
- [x] Implement exponential backoff on 429s (5 retries, `2^i * 1000ms` delay)
- [x] Add `POST /api/v1/assets/tts` endpoint — accepts `ScriptRecord` id, generates audio per scene
- [x] Store audio file URLs on `ScriptRecord`

### Runway Gen-3 Alpha Turbo (B-roll)
- [x] Create `RunwayService` (`src/services/runway.service.ts`)
- [x] Implement parallel batch processing of `b_roll_prompt` per scene
- [x] Handle async job polling (Runway returns job ID, not immediate output)
- [x] Add `POST /api/v1/assets/broll` endpoint
- [x] Store b-roll video URLs on `ScriptRecord`

### Epidemic Sound (Background Music)
- [x] Create `EpidemicSoundService` (`src/services/epidemic.service.ts`)
- [x] Implement music search/selection by `background_music_mood`
- [x] Monitor `X-RateLimit-Remaining` header; delay requests if `< 10`
- [x] Add `POST /api/v1/assets/music` endpoint
- [x] Store selected track info on `ScriptRecord`

---

## 🟡 Stage 4 — Rendering & Upload (Not Started)

### Remotion Rendering
- [ ] Set up Remotion project inside `backend/` or as a separate workspace
- [ ] Implement scene-to-frame composition using `visual_description` fields
- [ ] Sync audio duration with scene `duration_seconds` (frame-accurate)
- [ ] Validate all asset paths with `existsSync`; fall back to CSS hex color on failure
- [ ] Add `POST /api/v1/render` endpoint — triggers Remotion render job
- [ ] Store output MP4 path on `RenderJob`

### YouTube Upload
- [ ] Implement OAuth2 flow for YouTube channel authorization
- [ ] Create `YouTubeService` (`src/services/youtube.service.ts`)
- [ ] Add `POST /api/v1/upload` endpoint — uploads rendered MP4 with metadata
- [ ] Enforce manual review gate: only publish after explicit `POST /api/v1/publish/:jobId`
- [ ] Enforce 1-video-at-a-time cadence
- [ ] Enrich metadata: title, description (SEO), tags, category (Finance)

---

## 🟢 Testing

- [ ] Mock OpenAI calls in all agent tests (remove real API dependencies)
- [ ] Add unit tests for `auth.controller.ts`
- [ ] Add unit tests for `user.controller.ts`
- [ ] Add unit tests for `user.service.ts`
- [ ] Add unit tests for `errorHandler` and `validate` middleware
- [ ] Add integration tests for all `/ideation` and `/script` routes
- [ ] Reach and maintain ≥ 70% global coverage threshold (currently ~50%)

---

## 🟢 Infrastructure & DX

- [ ] Create `backend/.env.example` with all 15 required environment variable keys
- [ ] Add `Project` Mongoose model for grouping video ideas per channel/niche
- [ ] Add API documentation (Swagger/OpenAPI or Postman collection)
- [ ] Write docs for Script module (mirror `IDEATION_IMPLEMENTATION.md`)
- [ ] Write auth & user management docs
- [ ] Add `docker-compose.yml` for local MongoDB + app

---

## Done

- [x] `ViralIdeationModule` — single + batch idea generation with GPT-4o structured outputs
- [x] `ScriptGenerationModule` — 20+ scene scripts with ElevenLabs/Runway/Remotion/Epidemic fields
- [x] All Zod schemas (`IdeationResponseSchema`, `FullVideoScriptSchema`, `VideoSceneSchema`, etc.)
- [x] Express 5 app setup (Helmet, CORS, body parsing, graceful shutdown)
- [x] All 7 API endpoints wired (`/health`, `/auth/login`, `/users` CRUD, `/ideation/*`, `/script/*`)
- [x] User model + service (bcryptjs password hashing)
- [x] JWT login endpoint
- [x] Zod request validation middleware
- [x] Global error handler + 404 handler + request logger
- [x] Environment variable validation at startup (`src/config/env.ts`)
- [x] Base test suite (25 tests across app, ideation, script modules)
- [x] `IDEATION_IMPLEMENTATION.md` documentation
