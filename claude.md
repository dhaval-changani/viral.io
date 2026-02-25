# Finance Video Generator — Project Context

## Stack
- **Runtime:** Node.js v20+ / TypeScript
- **Video:** Remotion (React-based, renders `.mp4`)
- **LLM:** Vercel AI SDK + OpenAI GPT-4o with Structured Outputs (Zod)
- **APIs:** ElevenLabs (TTS), Runway Gen-3 Alpha Turbo (B-roll), Epidemic Sound (music)
- **Utilities:** `sharp` (image resize → 1920×1080), `dotenv`

## Architecture
1. **Script** → `ViralIdeationModule.ts` → `generateObject()` with Zod schema → JSON script (20+ scenes, 8+ min)
2. **Assets** → ElevenLabs MP3s + Runway video or `sharp` fallback images
3. **Render** → Remotion `Composition.tsx` syncs audio timestamps → final MP4

## Critical Patterns

### Always use `generateObject`, never `generateText`
```typescript
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({ /* strict types */ }),
  prompt: "...",
});
```

### Script hooks (pick one per video)
Fortune Teller · Experimenter · Teacher · Magician · Investigator · Contrarian

## Rules
- **No hardcoded keys** — always `process.env.API_KEY`
- **ElevenLabs 429s** — exponential backoff
- **Remotion** — verify all assets exist before `renderMedia()`; use placeholder color on failure
- **Epidemic Sound** — respect `X-RateLimit` headers
- **Upload cadence** — 1 video at a time, manual review before publish
- **Locale** — Tier-1 audience (US/UK/CA/AU), use `$` by default

## Directory
```
/src/agents        # AI scripting & ideation
/src/remotion      # Video components
/src/utils         # Asset downloaders, sharp
/assets/audio|images|temp
index.ts           # Entry point
```
