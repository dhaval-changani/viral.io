import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IdeationResponseSchema, type IdeationResponse } from './schemas';
import { logger } from '../utils/logger';

/**
 * ViralIdeationModule - Two-Stage Chain of Thought Ideation Engine
 *
 * This module applies proven viral frameworks to generate high-RPM finance video concepts:
 * 1. Primal Desires (caveman psychology)
 * 2. Content Gaps (high demand + low supply)
 * 3. Hook Archetypes (6 proven patterns)
 *
 * Uses Vercel AI SDK with GPT-4o Structured Outputs (Zod validation)
 * to ensure ideas pass MrBeast's Remarkability Test.
 */

/**
 * System Prompt: Encodes expert knowledge from viral video frameworks
 * Applied to the AI model to constrain outputs within proven patterns
 */
const SYSTEM_PROMPT = `You are a YouTube viral strategist specializing in the Finance Niche ($10–$25 RPM).

Your mission: Take a general finance topic and generate 5+ video ideas that pass the MrBeast Remarkability Test:
1. Would a stranger ask a follow-up question? (Curiosity Gap)
2. Is it "Primal"? (Appeals to survival, status, fear, greed—not logic)
3. Does it target a "Content Gap"? (High Demand, Low Supply)

---
MANDATORY: Apply the 6 Hook Archetypes (proven click magnets):

1. **Fortune Teller** - Predict a future outcome
   Example: "This new tax law changes everything in 2025..."
   
2. **Contrarian** - Attack common wisdom
   Example: "Stop buying S&P 500 (here's why)..."
   
3. **Investigator** - Reveal a secret or hidden data
   Example: "I found a secret bank account that makes $500/month..."
   
4. **Experimenter** - Test a hypothesis or extreme challenge
   Example: "I tried day trading on $100 for 7 days..."
   
5. **Teacher** - Simplify a complex method into steps
   Example: "Here's the exact 3-step formula for..."
   
6. **Magician** - Visual spectacle or "watch this" moment
   Example: "Watch what happens when I shred my credit card..."

---
PRIMAL DESIRES (pick ONE per idea):
- Fear of poverty / loss
- Greed / wealth accumulation
- Social status / respect / tribal belonging
- FOMO (missing opportunities)
- Self-improvement / mastery
- Security / survival

---
CONTENT GAP LOGIC:
Finance has thousands of videos. You MUST identify *specific* sub-niches with high search intent but low competition:
- Uncommon credit card strategies (not "best cards")
- Psychological hacks for saving (not "budgeting 101")
- Side hustles requiring <10 hours/week
- Loopholes or "legal shortcuts" (always framed ethically)
- Contrarian takes on popular advice

---
TITLE RULES (critical):
- Max 50 characters (YouTube cuts at 54 on mobile)
- Power words: "Secret", "Banned", "Only", "WARNING", "NEVER", "Finally"
- Curiosity gap: Viewer wonders "how?" or "why?"
- Never misleading (integrity = long-term RPM)

---
THUMBNAIL RULES:
- **Foreground**: Single, clear subject (face, object, or extreme visual)
- **Background**: High contrast context (graph, money, alarm)
- **Text**: Max 3 words. Bold, all-caps, white with black outline.

---
HOOK SCRIPT (first 5 seconds):
- Opens with curiosity or fear (not explanation)
- Must be 30–40 words (not a long intro)
- Spoken naturally, not robotically
- Followed by visual action that reinforces the hook

---
OUTPUT PRIORITIES:
1. Maximize RPM (finance niche = $10–$25 baseline)
2. Target Tier-1 audiences (US, UK, Canada, Australia) — use $ by default
3. Every idea must feel "new" or attack a specific gap
4. Avoid generic advice (already covered 10,000 times)
5. Primal desire must be authentic, not manipulative

---
Generate ideas that would make a finance creator think: "Wait... I haven't seen that angle before."
`;

/**
 * Generate Viral Video Ideas for a Finance Topic
 *
 * @param topic - General finance topic (e.g., "Credit Cards", "Side Hustles", "Taxes")
 * @param options - Optional overrides for model behavior
 * @returns Promise<IdeationResponse> - Structured output with ideas + analysis
 *
 * @throws Throws if OpenAI API fails or schema validation fails
 */
export async function generateViralIdeas(
  topic: string,
  options?: {
    temperature?: number;
    modelId?: string;
  }
): Promise<IdeationResponse> {
  const modelId = options?.modelId || 'gpt-4o';
  const temperature = options?.temperature ?? 0.7; // Balanced: creative but grounded

  logger.info(`[Ideation] Starting viral idea generation for topic: "${topic}"`);

  try {
    const { object } = await generateObject({
      model: openai(modelId),
      schema: IdeationResponseSchema,
      system: SYSTEM_PROMPT,
      prompt: `
Generate 5 viral video concepts for the finance topic: **${topic}**

Requirements:
- Each idea must pass the MrBeast Remarkability Test (curiosity gap, primal, content gap)
- Use exactly ONE of the 6 Hook Archetypes per idea
- Target Tier-1 audiences (US/UK/CA/AU). Use $ for currency.
- Maximize for high RPM in the finance niche ($10–$25 range)
- Identify specific content gaps (not generic advice)
- Each title must be under 50 characters
- Each hook script must be under 200 characters and be speakable in 5 seconds

Topic Analysis: Before generating ideas, analyze:
1. Why is this topic trending or relevant NOW?
2. What sub-niches or angles are UNDERSERVED?
3. What primal desires are triggered by this topic?
4. What makes this topic different from the 10,000+ existing videos?

Then generate 5 ideas that exploit these gaps.
      `,
      temperature,
    });

    logger.info(
      `[Ideation] Successfully generated ${object.ideas.length} viral ideas for topic: "${topic}"`
    );

    return object;
  } catch (error) {
    logger.error(
      `[Ideation] Failed to generate viral ideas for topic: "${topic}"`,
      error
    );
    throw new Error(
      `Ideation failed for topic "${topic}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Batch Generate Ideas for Multiple Topics
 * Useful for bulk content planning
 *
 * @param topics - Array of finance topics
 * @param options - Optional overrides
 * @returns Promise with results and errors for each topic
 */
export async function generateViralIdeasBatch(
  topics: string[],
  options?: {
    temperature?: number;
    modelId?: string;
    concurrency?: number;
  }
): Promise<{
  successful: Array<{ topic: string; ideas: IdeationResponse }>;
  failed: Array<{ topic: string; error: string }>;
}> {
  const concurrency = options?.concurrency ?? 3; // Respect rate limits
  const results = {
    successful: [] as Array<{ topic: string; ideas: IdeationResponse }>,
    failed: [] as Array<{ topic: string; error: string }>,
  };

  logger.info(`[Ideation] Starting batch generation for ${topics.length} topics`);

  // Process topics in batches to avoid rate limiting
  for (let i = 0; i < topics.length; i += concurrency) {
    const batch = topics.slice(i, i + concurrency);
    const promises = batch.map(async (topic) => {
      try {
        const ideas = await generateViralIdeas(topic, options);
        results.successful.push({ topic, ideas });
      } catch (error) {
        results.failed.push({
          topic,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(promises);
  }

  logger.info(
    `[Ideation] Batch complete: ${results.successful.length} success, ${results.failed.length} failures`
  );

  return results;
}

/**
 * Generate Ideas with Custom System Prompt
 * Allows tweaking the framework for specific use cases
 *
 * @param topic - Finance topic
 * @param customSystemPrompt - Override the default system prompt
 * @param options - Optional model params
 * @returns Promise<IdeationResponse>
 */
export async function generateViralIdeasWithCustomPrompt(
  topic: string,
  customSystemPrompt: string,
  options?: {
    temperature?: number;
    modelId?: string;
  }
): Promise<IdeationResponse> {
  logger.info(
    `[Ideation] Starting generation with custom prompt for topic: "${topic}"`
  );

  try {
    const { object } = await generateObject({
      model: openai(options?.modelId || 'gpt-4o'),
      schema: IdeationResponseSchema,
      system: customSystemPrompt,
      prompt: `Generate 5 viral video concepts for the finance topic: **${topic}**`,
      temperature: options?.temperature ?? 0.7,
    });

    return object;
  } catch (error) {
    logger.error(
      `[Ideation] Custom prompt generation failed for topic: "${topic}"`,
      error
    );
    throw error;
  }
}
