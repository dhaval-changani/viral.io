import { z } from 'zod';

/**
 * Viral Hook Archetypes - Based on Kallaway's 6 Hook Framework
 * Each represents a proven pattern for capturing viewer attention
 */
export const HookTypeEnum = z.enum([
  'Fortune Teller', // "This new tax law changes everything..."
  'Experimenter', // "I tried day trading for 7 days..."
  'Teacher', // "Here is the exact formula for..."
  'Magician', // Visual stun gun / "Watch this..."
  'Investigator', // "I found a secret bank account..."
  'Contrarian', // "Stop buying S&P 500..."
]);

export type HookType = z.infer<typeof HookTypeEnum>;

/**
 * Thumbnail Composition Schema
 * Enforces visual hierarchy: foreground → background → text overlay
 */
const ThumbnailConceptSchema = z.object({
  foreground: z
    .string()
    .describe(
      'Main focus element (e.g., "Sad face holding burnt money"). Single clear subject.'
    ),
  background: z
    .string()
    .describe(
      'Context setting (e.g., "Stock market crashing graph"). High contrast to foreground.'
    ),
  text_overlay: z
    .string()
    .max(3, 'Max 3 words for readability on mobile')
    .describe(
      'Bold text overlay (e.g., "DON\'T DO THIS"). Use power words like: SECRET, BANNED, ONLY, WARNING'
    ),
});

export type ThumbnailConcept = z.infer<typeof ThumbnailConceptSchema>;

/**
 * Hook Script Schema
 * First 5 seconds of audio + visual action must create an immediate curiosity gap
 */
const HookScriptSchema = z.object({
  type: HookTypeEnum.describe('One of the 6 proven hook archetypes'),
  spoken_audio: z
    .string()
    .max(200, 'Keep to ~30-40 words for 5-second hook')
    .describe(
      'First 5 seconds script. Must create immediate curiosity gap. Use: Question / Contradiction / Extreme Statement.'
    ),
  visual_action: z
    .string()
    .describe(
      'What happens on screen during hook? (e.g., "Hand shredding a credit card"). Must be visually arresting.'
    ),
});

export type HookScript = z.infer<typeof HookScriptSchema>;

/**
 * Single Viral Video Concept
 * Represents one actionable video idea that passes MrBeast's Remarkability Test:
 * 1. Would a stranger ask a follow-up question?
 * 2. Is it "Primal"? (Appeals to survival, status, fear, greed)
 * 3. Does it target a "Content Gap" (High Demand, Low Supply)?
 */
export const ViralVideoSchema = z.object({
  title: z
    .string()
    .max(50, 'Keep under 50 chars for mobile optimization (54-char cutoff)')
    .describe('Clicky title using power words like "Secret", "Banned", "Only". Must pass curiosity gap test.'),

  thumbnail_concept: ThumbnailConceptSchema.describe(
    'Visual composition following Rule of Thirds or Contrast. Foreground must pop against background.'
  ),

  hook_script: HookScriptSchema.describe(
    'First 5 seconds of video. Must stop thumb scrolling with curiosity, fear, or spectacle.'
  ),

  primal_desire: z
    .enum([
      'Fear of poverty',
      'Greed / wealth accumulation',
      'Social status / respect',
      'FOMO (missing out)',
      'Tribal belonging',
      'Survival / security',
      'Self-improvement',
      'Validation / recognition',
    ])
    .describe(
      'Which primal emotion does this trigger? Must be rooted in caveman psychology, not logic.'
    ),

  estimated_rpm: z
    .number()
    .min(5)
    .max(50)
    .describe(
      'Estimated Revenue Per 1,000 views. Finance niche: $10-$25. Adjust based on sub-niche.'
    ),

  content_gap_reason: z
    .string()
    .max(150)
    .describe(
      'Why is this idea in a content gap? (High demand + low supply). E.g., "Low-competition credit card strategies with high search intent"'
    ),
});

export type ViralVideo = z.infer<typeof ViralVideoSchema>;

/**
 * Complete Ideation Response
 * Output of the Ideation Module: analysis + 5+ video concepts
 */
export const IdeationResponseSchema = z.object({
  topic_analysis: z
    .string()
    .max(300)
    .describe(
      'Brief analysis: Why is this topic trending? What content gaps exist? What primal desires are underserved?'
    ),

  ideas: z
    .array(ViralVideoSchema)
    .min(3)
    .max(10)
    .describe('Array of viral video concepts. Each must pass MrBeast Remarkability Test.'),

  niche_specifics: z
    .object({
      target_niche: z.string().describe('e.g., "Personal Finance / Credit Optimization"'),
      audience_tier: z.enum(['Tier-1 (US/UK/CA/AU)', 'Tier-2', 'Global']),
      estimated_avg_rpm: z.number().describe('Average RPM across all ideas'),
    })
    .describe('Niche-specific context for the generated ideas'),
});

export type IdeationResponse = z.infer<typeof IdeationResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Script Generation Schemas
// Output of ScriptGenerationModule — consumed by ElevenLabs, Runway, Remotion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Background music mood per scene — maps to Epidemic Sound mood filter
 */
export const SceneMoodEnum = z.enum([
  'tense',
  'uplifting',
  'neutral',
  'dramatic',
  'inspiring',
  'suspenseful',
  'calm',
  'urgent',
]);

export type SceneMood = z.infer<typeof SceneMoodEnum>;

/**
 * Scene-to-scene transition type
 */
export const SceneTransitionEnum = z.enum([
  'cut',
  'fade',
  'dissolve',
  'wipe',
  'zoom',
]);

export type SceneTransition = z.infer<typeof SceneTransitionEnum>;

/**
 * VideoSceneSchema
 * One atomic scene unit in the final video.
 * Maps directly to:
 *  - Remotion <Sequence> frame range (scene_number, duration_seconds)
 *  - ElevenLabs TTS input (spoken_script)
 *  - Runway Gen-3 Alpha Turbo prompt (b_roll_prompt)
 *  - Remotion compositor layout (visual_description, on_screen_text)
 *  - Epidemic Sound filter (background_music_mood)
 */
export const VideoSceneSchema = z.object({
  scene_number: z
    .number()
    .int()
    .min(1)
    .describe('Sequential scene index starting at 1'),

  duration_seconds: z
    .number()
    .min(5)
    .max(60)
    .describe(
      'Scene duration in seconds. Hook scenes: 5–10s. Body scenes: 20–40s. CTA: 10–15s.'
    ),

  spoken_script: z
    .string()
    .min(10)
    .max(600)
    .describe(
      'Narration text for ElevenLabs TTS. Must be natural, speakable, and match visual_description. No stage directions.'
    ),

  visual_description: z
    .string()
    .min(10)
    .max(300)
    .describe(
      'Remotion compositor layout. Describe what appears on screen: subject, motion, framing, text overlay positions. Example: "Full-screen B-roll of stock chart crashing. Lower-third: HUGE RISK."'
    ),

  b_roll_prompt: z
    .string()
    .min(10)
    .max(400)
    .describe(
      'Runway Gen-3 Alpha Turbo prompt. Format: [subject] + [motion verb] + [camera angle] + [lighting/mood]. Example: "Close-up of hands shredding a credit card, slow motion, shallow depth of field, dramatic side lighting."'
    ),

  background_music_mood: SceneMoodEnum.describe(
    'Emotional tone for background music. Maps to Epidemic Sound mood filter.'
  ),

  on_screen_text: z
    .string()
    .max(80)
    .optional()
    .describe(
      'Optional caption or text overlay. Max 80 chars. Use for key stats, emphasis words, or chapter titles. Skip for conversational scenes.'
    ),

  transition: SceneTransitionEnum.optional().describe(
    'Transition to next scene. Use "cut" for fast-paced content; "fade" for emotional beats.'
  ),
});

export type VideoScene = z.infer<typeof VideoSceneSchema>;

/**
 * YouTube chapter marker for automatic chapter detection
 * First marker must always be at timestamp_seconds: 0
 */
const ChapterMarkerSchema = z.object({
  timestamp_seconds: z
    .number()
    .int()
    .min(0)
    .describe('Absolute timestamp in seconds from video start. First marker must be 0.'),
  title: z
    .string()
    .max(60)
    .describe('Chapter title shown in YouTube timeline. Short, descriptive, like a subheading.'),
});

/**
 * FullVideoScriptSchema
 * Complete render-ready script for a finance YouTube video.
 * Output of ScriptGenerationModule — consumed by:
 *  1. ElevenLabs TTS pipeline (spoken_script per scene)
 *  2. Runway Gen-3 Alpha Turbo (b_roll_prompt per scene)
 *  3. Remotion compositor (all fields for frame-accurate rendering)
 */
export const FullVideoScriptSchema = z.object({
  video_title: z
    .string()
    .max(100)
    .describe('Final video title. Should match or refine the source ViralVideo title.'),

  total_duration_seconds: z
    .number()
    .min(480)
    .max(1800)
    .describe(
      'Total video duration in seconds. Target: 480–900s (8–15 min) for maximum mid-roll ad revenue on finance content. sum(scene.duration_seconds) should equal this value ±5s.'
    ),

  scenes: z
    .array(VideoSceneSchema)
    .min(20)
    .max(60)
    .describe(
      'Ordered array of video scenes. Must include: hook (scene 1), hook reinforcement (scenes 2–4), content body, and CTA (final scene). scene_number values must be sequential starting at 1.'
    ),

  intro_hook_reinforcement: z
    .string()
    .max(300)
    .describe(
      'A 30–60 second post-hook statement reinforcing the curiosity gap without resolving it. Example: "And by the end of this video, you will know exactly how to use this — legally — before the window closes."'
    ),

  call_to_action: z
    .string()
    .max(200)
    .describe(
      'Final 15–30 second CTA script. Must be topic-specific (not generic "like and subscribe"). Drive: subscribe, like, comment, or watch next video.'
    ),

  chapter_markers: z
    .array(ChapterMarkerSchema)
    .min(3)
    .max(15)
    .describe(
      'YouTube chapter markers in ascending timestamp order. First marker MUST be at timestamp_seconds: 0. Enables YouTube auto-chapters.'
    ),
});

export type FullVideoScript = z.infer<typeof FullVideoScriptSchema>;
