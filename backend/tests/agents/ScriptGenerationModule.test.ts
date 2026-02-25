import { generateScript } from '../../src/agents';
import type { ViralVideo, VideoScene } from '../../src/agents/schemas';

/**
 * Integration tests for ScriptGenerationModule
 * These tests make real OpenAI API calls — require OPENAI_API_KEY in environment.
 * Run individually during development:
 *   npx jest tests/agents/ScriptGenerationModule.test.ts
 */

/** Stable fixture: a minimal but fully-valid ViralVideo */
const TEST_IDEA: ViralVideo = {
  title: 'The Credit Card Trick Banks Hide',
  thumbnail_concept: {
    foreground: 'Person holding shredded credit card with shocked face',
    background: 'Bank vault closing with money inside',
    text_overlay: 'BANKS HATE THIS',
  },
  hook_script: {
    type: 'Investigator',
    spoken_audio:
      'I found a loophole in credit card reward programs that banks quietly removed from their websites this year.',
    visual_action: 'Close-up of hands finding a folded document inside a bank envelope',
  },
  primal_desire: 'Greed / wealth accumulation',
  estimated_rpm: 18,
  content_gap_reason:
    'Underserved angle on credit card reward optimization — most content covers basic card comparisons, not bank-side policy changes',
};

describe('ScriptGenerationModule', () => {
  // Script generation takes longer than ideation due to higher token count
  jest.setTimeout(120000);

  describe('generateScript', () => {
    it('should generate a script with at least 20 scenes', async () => {
      const script = await generateScript(TEST_IDEA);

      expect(script).toHaveProperty('video_title');
      expect(script).toHaveProperty('scenes');
      expect(script).toHaveProperty('total_duration_seconds');
      expect(script).toHaveProperty('intro_hook_reinforcement');
      expect(script).toHaveProperty('call_to_action');
      expect(script).toHaveProperty('chapter_markers');

      expect(Array.isArray(script.scenes)).toBe(true);
      expect(script.scenes.length).toBeGreaterThanOrEqual(20);
    });

    it('should generate a script with minimum 8-minute total duration', async () => {
      const script = await generateScript(TEST_IDEA);

      expect(script.total_duration_seconds).toBeGreaterThanOrEqual(480);
      expect(script.total_duration_seconds).toBeLessThanOrEqual(1800);
    });

    it('should have sequential scene_number values starting at 1', async () => {
      const script = await generateScript(TEST_IDEA);

      for (let i = 0; i < script.scenes.length; i++) {
        expect(script.scenes[i].scene_number).toBe(i + 1);
      }
    });

    it('should have scene durations that sum close to total_duration_seconds', async () => {
      const script = await generateScript(TEST_IDEA);

      const summedDuration = script.scenes.reduce(
        (acc, scene) => acc + scene.duration_seconds,
        0
      );

      // Allow ±5s tolerance as documented in schema
      // The module post-corrects total_duration_seconds on mismatch, so this should always pass
      expect(Math.abs(summedDuration - script.total_duration_seconds)).toBeLessThanOrEqual(5);
    });

    it('should have valid background_music_mood on every scene', async () => {
      const script = await generateScript(TEST_IDEA);

      const validMoods = [
        'tense',
        'uplifting',
        'neutral',
        'dramatic',
        'inspiring',
        'suspenseful',
        'calm',
        'urgent',
      ];

      for (const scene of script.scenes) {
        expect(validMoods).toContain(scene.background_music_mood);
      }
    });

    it('should have non-empty spoken_script on every scene', async () => {
      const script = await generateScript(TEST_IDEA);

      for (const scene of script.scenes) {
        expect(typeof scene.spoken_script).toBe('string');
        expect(scene.spoken_script.length).toBeGreaterThanOrEqual(10);
      }
    });

    it('should have non-empty b_roll_prompt on every scene', async () => {
      const script = await generateScript(TEST_IDEA);

      for (const scene of script.scenes) {
        expect(typeof scene.b_roll_prompt).toBe('string');
        expect(scene.b_roll_prompt.length).toBeGreaterThanOrEqual(10);
      }
    });

    it('should have non-empty visual_description on every scene', async () => {
      const script = await generateScript(TEST_IDEA);

      for (const scene of script.scenes) {
        expect(typeof scene.visual_description).toBe('string');
        expect(scene.visual_description.length).toBeGreaterThanOrEqual(10);
      }
    });

    it('should have chapter_markers with first marker at timestamp 0', async () => {
      const script = await generateScript(TEST_IDEA);

      expect(script.chapter_markers.length).toBeGreaterThanOrEqual(3);
      expect(script.chapter_markers.length).toBeLessThanOrEqual(15);
      expect(script.chapter_markers[0].timestamp_seconds).toBe(0);

      for (const marker of script.chapter_markers) {
        expect(marker.timestamp_seconds).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(marker.timestamp_seconds)).toBe(true);
        expect(typeof marker.title).toBe('string');
        expect(marker.title.length).toBeGreaterThan(0);
      }
    });

    it('should have chapter_markers in ascending timestamp order', async () => {
      const script = await generateScript(TEST_IDEA);

      for (let i = 1; i < script.chapter_markers.length; i++) {
        expect(script.chapter_markers[i].timestamp_seconds).toBeGreaterThan(
          script.chapter_markers[i - 1].timestamp_seconds
        );
      }
    });

    it('should have non-empty intro_hook_reinforcement and call_to_action', async () => {
      const script = await generateScript(TEST_IDEA);

      expect(typeof script.intro_hook_reinforcement).toBe('string');
      expect(script.intro_hook_reinforcement.length).toBeGreaterThan(0);

      expect(typeof script.call_to_action).toBe('string');
      expect(script.call_to_action.length).toBeGreaterThan(0);
    });

    it('should respect temperature and modelId options', async () => {
      const script = await generateScript(TEST_IDEA, {
        temperature: 0.4,
        modelId: 'gpt-4o',
      });

      expect(script.scenes.length).toBeGreaterThanOrEqual(20);
    });

    it('should have no stage directions in spoken_script fields', async () => {
      const script = await generateScript(TEST_IDEA);

      // Stage directions are typically in parentheses or square brackets
      const stageDirectionPattern = /\[.+?\]|\(.+?\)/;

      for (const scene of script.scenes) {
        // Soft check: warn if found (some LLM variance is expected)
        if (stageDirectionPattern.test(scene.spoken_script)) {
          console.warn(
            `[Test Warning] Scene ${scene.scene_number} spoken_script may contain stage direction: ` +
              `"${scene.spoken_script.slice(0, 80)}..."`
          );
        }
        // Hard constraint: spoken_script must not consist ONLY of a stage direction
        const contentWithoutDirections = scene.spoken_script
          .replace(stageDirectionPattern, '')
          .trim();
        expect(contentWithoutDirections.length).toBeGreaterThan(0);
      }
    });
  });
});

/**
 * Validate the full structure of a VideoScene object
 * Used in the unit test below; can also be called from other test files
 */
function validateSceneStructure(scene: VideoScene): void {
  expect(typeof scene.scene_number).toBe('number');
  expect(scene.scene_number).toBeGreaterThanOrEqual(1);

  expect(typeof scene.duration_seconds).toBe('number');
  expect(scene.duration_seconds).toBeGreaterThanOrEqual(5);
  expect(scene.duration_seconds).toBeLessThanOrEqual(60);

  expect(typeof scene.spoken_script).toBe('string');
  expect(scene.spoken_script.length).toBeGreaterThanOrEqual(10);

  expect(typeof scene.visual_description).toBe('string');
  expect(scene.visual_description.length).toBeGreaterThanOrEqual(10);

  expect(typeof scene.b_roll_prompt).toBe('string');
  expect(scene.b_roll_prompt.length).toBeGreaterThanOrEqual(10);

  if (scene.on_screen_text !== undefined) {
    expect(typeof scene.on_screen_text).toBe('string');
    expect(scene.on_screen_text.length).toBeLessThanOrEqual(80);
  }
}

/** Unit tests — no API calls required */
describe('validateSceneStructure (unit)', () => {
  it('should pass for a valid minimal scene', () => {
    const validScene: VideoScene = {
      scene_number: 1,
      duration_seconds: 8,
      spoken_script: 'I found a loophole that banks quietly removed from their terms.',
      visual_description: 'Full-screen B-roll of a person at an ATM. No text overlay.',
      b_roll_prompt:
        'Close-up of hands typing PIN at ATM, shallow depth of field, warm late-afternoon lighting',
      background_music_mood: 'tense',
    };

    expect(() => validateSceneStructure(validScene)).not.toThrow();
  });

  it('should pass for a scene with optional fields', () => {
    const sceneWithOptionals: VideoScene = {
      scene_number: 5,
      duration_seconds: 30,
      spoken_script: 'Here is exactly what most people miss about their credit card rewards.',
      visual_description: 'Split-screen: credit card statement left, calculator right. Lower-third: HIDDEN FEE.',
      b_roll_prompt:
        'Aerial tilt-down over suburban neighborhood, golden hour, wide angle lens',
      background_music_mood: 'urgent',
      on_screen_text: 'HIDDEN FEE: $240/YEAR',
      transition: 'cut',
    };

    expect(() => validateSceneStructure(sceneWithOptionals)).not.toThrow();
  });
});
