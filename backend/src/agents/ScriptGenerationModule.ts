import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { FullVideoScriptSchema, type FullVideoScript, type ViralVideo } from './schemas';
import { logger } from '../utils/logger';

/**
 * ScriptGenerationModule - Scene-Level Video Script Engine
 *
 * Takes a validated ViralVideo idea (output of ViralIdeationModule) and
 * expands it into a full, render-ready 20+ scene video script.
 *
 * Each scene maps directly to:
 *  1. ElevenLabs TTS (spoken_script)
 *  2. Runway Gen-3 Alpha Turbo B-roll (b_roll_prompt)
 *  3. Remotion frame compositor (all fields)
 *  4. Epidemic Sound filter (background_music_mood)
 *
 * Uses Vercel AI SDK with GPT-4o Structured Outputs (Zod validation)
 * to guarantee schema compliance on every generation.
 */

const SYSTEM_PROMPT = `You are a professional YouTube scriptwriter specializing in long-form finance content (8–15 minutes).

Your task: Take a validated viral video concept and write a complete, scene-by-scene video script with 20 or more scenes that is ready for automated production.

---
SCRIPT ARCHITECTURE (follow this structure exactly):

**Scene 1 — Hook (5–10 seconds)**
- Deliver the hook_script.spoken_audio verbatim or slightly improved.
- Visual matches hook_script.visual_action exactly.
- b_roll_prompt must be cinematic and visually striking.
- background_music_mood: "tense" or "dramatic"

**Scenes 2–4 — Hook Reinforcement / Open Loop (60–120 seconds)**
- Reinforce the curiosity gap opened in scene 1.
- Preview what the viewer will learn ("By the end of this video...").
- Do NOT reveal the main answer yet. Maintain tension.
- background_music_mood: "suspenseful" or "tense"

**Scenes 5 through N-2 — Content Body (6–11 minutes)**
- Deliver the substance. Teach, reveal, or demonstrate the core topic in depth.
- Use the problem → complication → resolution structure.
- Include at minimum: 3 concrete examples, 2 specific data points or statistics, 1 personal-story framing.
- Each scene covers ONE clear idea. Never cover more than one concept per scene.
- Vary pacing: alternate slow-reveal scenes (30–40s) with fast-cut summary scenes (10–15s).
- background_music_mood: rotate through "neutral", "inspiring", "uplifting", "urgent" based on content rhythm.

**Scene N-1 — Summary (20–30 seconds)**
- Summarize the 3 key takeaways.
- background_music_mood: "uplifting"

**Scene N — Call to Action (15–30 seconds)**
- Deliver the call_to_action.
- Must be topic-specific, not generic.
- background_music_mood: "inspiring"

---
SPOKEN SCRIPT RULES:
- Write as if speaking directly to ONE viewer. Use "you" not "viewers".
- Use short, punchy sentences. Average sentence: 10–15 words.
- NEVER use: "In this video", "Let's get started", "Without further ado", "Welcome back".
- Use rhetorical devices: "here's the thing", "but wait", "here's what most people miss", "and this is where it gets interesting".
- Pacing: ~150 words per minute. A 30-second scene = ~75 words of spoken script.
- NO stage directions in spoken_script. Only the words the narrator says.

---
B-ROLL PROMPT RULES (for Runway Gen-3 Alpha Turbo):
- Format: [subject] + [motion verb] + [camera angle] + [lighting/mood]
- Example: "Aerial drone shot slowly tilting down onto Wall Street at golden hour, motion blur on taxi traffic below"
- Always include a motion verb: zooming, panning, tracking, tilting, orbiting, etc.
- Avoid faces (copyright/likeness risk). Focus on objects, environments, abstract visuals.
- Match the emotional tone of the scene's spoken_script.
- Keep it under 400 characters.

---
VISUAL DESCRIPTION RULES (for Remotion compositor):
- Describe the screen layout and composition, not the camera.
- Example: "Full-screen B-roll of busy stock exchange floor. Lower-third text: '$2.3 TRILLION LOST'. No talking head."
- Always specify: text overlays if any, screen split if applicable, whether B-roll is full-screen or framed.

---
ON-SCREEN TEXT RULES:
- Use for: key statistics, highlight quotes, chapter titles, emphasis words.
- Max 80 characters. Use ALL CAPS for single emphasis words.
- Skip for conversational or narrative scenes where text would distract.

---
CHAPTER MARKERS:
- First marker: timestamp_seconds MUST be 0.
- Add a new marker at every major topic shift (every 1–3 minutes).
- Title format: short, descriptive, 3–6 words. Like a subheading.
- Minimum 3, maximum 15 markers.
- Timestamps must be in strictly ascending order.

---
DURATION TARGETS:
- Total video: 480–900 seconds (8–15 minutes). Finance RPM peaks at 8–12 minutes.
- The sum of all scene.duration_seconds MUST equal total_duration_seconds within ±5 seconds.
- Hook scene: 5–10s. Reinforcement scenes: 20–40s each. Body scenes: 20–40s each. CTA: 15–30s.

---
PRIMAL DESIRE CALIBRATION:
Every third scene should subtly reinforce the primal_desire provided:
- "Fear of poverty" → reference what the viewer LOSES by ignoring this information
- "Greed / wealth accumulation" → cite specific dollar amounts and realistic timelines
- "FOMO (missing out)" → reference time-sensitive windows or opportunities closing
- "Self-improvement" → frame the viewer as the hero who will finally master this skill
- "Survival / security" → connect to protecting family or building safety nets

---
OUTPUT QUALITY BAR:
Write at the level of a professional scriptwriter producing content for a 500k-subscriber finance channel. The script must be immediately usable for production with no editing required.
`;

/**
 * Build a structured user prompt from a ViralVideo idea
 */
function buildPrompt(idea: ViralVideo): string {
  return `Generate a complete, production-ready video script for the following validated viral video concept:

---
VIDEO TITLE: ${idea.title}

HOOK TYPE: ${idea.hook_script.type}
HOOK SPOKEN AUDIO (scene 1 must open with this): "${idea.hook_script.spoken_audio}"
HOOK VISUAL ACTION (scene 1 visual must match this): "${idea.hook_script.visual_action}"

THUMBNAIL CONTEXT:
  Foreground: "${idea.thumbnail_concept.foreground}"
  Background: "${idea.thumbnail_concept.background}"
  Text: "${idea.thumbnail_concept.text_overlay}"

PRIMAL DESIRE TO REINFORCE: ${idea.primal_desire}
CONTENT GAP ANGLE: ${idea.content_gap_reason}
ESTIMATED RPM: $${idea.estimated_rpm} (Tier-1 finance audience: US/UK/CA/AU)

---
REQUIREMENTS:
1. Scene 1 opens with the hook spoken_audio (verbatim or improved) and hook visual_action.
2. Scenes 2–4 reinforce the open-loop curiosity gap without resolving it.
3. Content body (scenes 5 through N-2) delivers specific, substantive finance education on the topic.
4. Every b_roll_prompt is a cinematic Runway Gen-3 prompt: subject + motion verb + camera angle + lighting.
5. Every spoken_script sounds natural when read aloud at 150 words/minute.
6. The sum of all scene.duration_seconds must equal total_duration_seconds within ±5 seconds.
7. The final scene contains a direct, topic-specific call to action.
8. chapter_markers[0].timestamp_seconds must be exactly 0.
9. Minimum 20 scenes. Target 24–28 scenes for an 8–12 minute video.
10. scene_number values must be sequential integers starting at 1.

Generate the complete script now.
`;
}

/**
 * Generate a full scene-by-scene video script from a ViralVideo idea
 *
 * @param selectedIdea - A ViralVideo object produced by ViralIdeationModule.generateViralIdeas()
 * @param options - Optional overrides for model behavior
 * @returns Promise<FullVideoScript> - Complete render-ready script with 20+ scenes
 *
 * @throws Throws if OpenAI API fails or schema validation fails
 *
 * @example
 * const ideas = await generateViralIdeas('Credit Cards');
 * const script = await generateScript(ideas.ideas[0]);
 * // script.scenes.length >= 20
 * // script.scenes[0].spoken_script contains the hook
 * // script.total_duration_seconds >= 480
 */
export async function generateScript(
  selectedIdea: ViralVideo,
  options?: {
    temperature?: number;
    modelId?: string;
  }
): Promise<FullVideoScript> {
  const modelId = options?.modelId ?? 'gpt-4o';
  const temperature = options?.temperature ?? 0.6; // Lower than ideation: structure > creativity

  logger.info(
    `[ScriptGen] Starting script generation for idea: "${selectedIdea.title}"`
  );

  try {
    const { object } = await generateObject({
      model: openai(modelId),
      schema: FullVideoScriptSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(selectedIdea),
      temperature,
    });

    // Post-validate duration sum — silently correct rather than re-calling the API
    const summedDuration = object.scenes.reduce(
      (acc, scene) => acc + scene.duration_seconds,
      0
    );
    if (Math.abs(summedDuration - object.total_duration_seconds) > 5) {
      logger.warn(
        `[ScriptGen] Duration mismatch for "${object.video_title}": ` +
          `declared=${object.total_duration_seconds}s, summed=${summedDuration}s. Correcting.`
      );
      object.total_duration_seconds = summedDuration;
    }

    logger.info(
      `[ScriptGen] Successfully generated script: "${object.video_title}" — ` +
        `${object.scenes.length} scenes, ${object.total_duration_seconds}s total`
    );

    return object;
  } catch (error) {
    logger.error(
      `[ScriptGen] Failed to generate script for idea: "${selectedIdea.title}"`,
      error
    );
    throw new Error(
      `Script generation failed for "${selectedIdea.title}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
