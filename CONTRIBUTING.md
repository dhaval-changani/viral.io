# Contributing to Finance Video Generator

## Project Overview

This is an automated finance video generation system that uses AI to create engaging video content with script generation, voice synthesis, B-roll, and music composition.

## Prerequisites

- **Node.js:** v20 or higher
- **TypeScript:** Latest stable version
- **Package Manager:** npm or yarn

## Tech Stack

### Core Technologies
- **Runtime:** Node.js v20+ / TypeScript
- **Video Rendering:** Remotion (React-based video library)
- **AI/LLM:** Vercel AI SDK + OpenAI GPT-4o with Structured Outputs (Zod for schema validation)
- **Text-to-Speech:** ElevenLabs API
- **Video Generation:** Runway Gen-3 Alpha Turbo
- **Music Licensing:** Epidemic Sound API
- **Image Processing:** Sharp (for 1920×1080 resizing)
- **Environment Management:** dotenv

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd viral.io
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_key_here

# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Runway API
RUNWAY_API_KEY=your_runway_key_here

# Epidemic Sound API
EPIDEMIC_SOUND_API_KEY=your_epidemic_sound_key_here

# Optional: Other configuration
NODE_ENV=development
```

### 4. Backend Setup
```bash
cd backend
npm install
npm run dev
```

## Project Structure

```
viral.io/
├── src/
│   ├── agents/           # AI scripting & ideation modules
│   ├── remotion/         # Video composition components
│   ├── utils/            # Asset downloaders, image processing
│   └── index.ts          # Entry point
├── backend/              # Express server API
│   ├── src/
│   │   ├── config/       # Database & environment config
│   │   ├── controllers/  # API controllers
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # Database models
│   │   ├── routes/       # API route definitions
│   │   ├── schemas/      # Validation schemas
│   │   ├── services/     # Business logic
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # Utility functions
│   └── tests/            # Test files
├── assets/
│   ├── audio/            # Generated & cached audio files
│   ├── images/           # Generated & cached images
│   └── temp/             # Temporary processing files
├── claude.md             # Project context & guidelines
└── CONTRIBUTING.md       # This file
```

## Development Workflow

### 1. Video Generation Pipeline

The video generation follows this flow:

```
Script Generation
    ↓
[ViralIdeationModule.ts using generateObject()]
    ↓
JSON Script (20+ scenes, 8+ minutes)
    ↓
Asset Generation
    ↓
ElevenLabs MP3s + Runway video/Sharp fallback images
    ↓
Video Rendering
    ↓
Remotion Composition syncs audio timestamps
    ↓
Final MP4 Output
```

### 2. Running Development Server

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Development environment
npm run dev
```

### 3. Building for Production

```bash
npm run build
```

## Critical Development Patterns

### Always use `generateObject`, never `generateText`

When working with OpenAI API calls, always use structured output generation:

```typescript
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    // Define your strict schema here
    scenes: z.array(z.object({
      id: z.number(),
      description: z.string(),
    })),
  }),
  prompt: "Generate video script with scenes...",
});
```

### Script Hooks

Each video must use one of the following narrative hooks:
- **Fortune Teller** - Predictive/forecasting narrative
- **Experimenter** - Trial and discovery approach
- **Teacher** - Educational, instructional tone
- **Magician** - Surprising, magical reveal
- **Investigator** - Investigation/detective approach
- **Contrarian** - Challenging conventional wisdom

## Important Rules & Guidelines

### API Keys & Secrets
- **Never hardcode API keys** — always use `process.env.API_KEY`
- Store all secrets in `.env` file (never commit this file)
- Use environment-specific configs in `backend/src/config/env.ts`

### ElevenLabs Integration
- Implement **exponential backoff** for 429 (rate limit) responses
- Cache generated audio files to avoid redundant API calls
- Respect API usage limits

### Remotion Video Rendering
- **Always verify all assets exist** before calling `renderMedia()`
- Use **placeholder colors** on asset loading failures
- Test with lower-resolution outputs during development

### Epidemic Sound Integration
- **Respect `X-RateLimit` headers** in responses
- Implement request queuing to avoid hitting limits
- Cache music selections

### Video Publishing
- **One video at a time** upload cadence
- **Manual review required** before publishing
- Log all upload events for audit trail

### Locale & Currency
- Target **Tier-1 audience** (US, UK, CA, AU)
- Use **`$` (USD)** as default currency by default
- Adapt content and formatting for regional preferences

## Testing

Run tests with:
```bash
npm test
```

Backend tests:
```bash
cd backend
npm test
```

## Troubleshooting

### 429 Errors (Rate Limiting)
- ElevenLabs and Epidemic Sound have rate limits
- Implement exponential backoff: wait 2s, 4s, 8s, 16s...
- Consider caching responses

### Asset Generation Failures
- Verify API keys are valid and have sufficient quota
- Check network connectivity
- Ensure Runway and ElevenLabs services are up
- Use fallback images (Sharp-generated placeholder)

### Video Rendering Issues
- Verify all source audio/video files exist in `/assets/`
- Check Remotion composition syntax
- Ensure timestamps match audio duration exactly

## Code Quality

- Use **TypeScript** for all new code
- Follow existing code style and patterns
- Add comments for complex logic
- Write tests for new features

## Commit Guidelines

```
feat: Add new feature description
fix: Fix bug description
docs: Update documentation
refactor: Code restructuring
test: Add tests
chore: Maintenance tasks
```

## Performance Considerations

- **Concurrent API calls:** Batch requests where possible
- **Caching:** Store generated assets to avoid regeneration
- **Asset validation:** Pre-flight checks before rendering
- **Memory management:** Clean up temp files after processing

## Additional Resources

- [Remotion Documentation](https://www.remotion.dev/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [ElevenLabs API](https://elevenlabs.io/docs/api-reference)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)

## Support & Questions

For questions or issues:
1. Check existing GitHub issues
2. Review the `claude.md` file for project context
3. Create a new issue with detailed description and reproduction steps

## License

See [LICENSE](LICENSE) file for details.
