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
