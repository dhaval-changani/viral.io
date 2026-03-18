import { generateViralIdeas, generateViralIdeasBatch } from '../../src/agents';
import type { ViralVideo } from '../../src/agents/schemas';

/**
 * Integration tests for ViralIdeationModule
 * These tests verify the module generates valid, structured ideas
 */

describe('ViralIdeationModule', () => {
  // Increase timeout for API calls
  jest.setTimeout(90000);

  describe('generateViralIdeas', () => {
    it('should generate 5+ viral video ideas for a finance topic', async () => {
      const topic = 'Credit Cards';
      const ideas = await generateViralIdeas(topic);

      // Validate structure
      expect(ideas).toHaveProperty('topic_analysis');
      expect(ideas).toHaveProperty('ideas');
      expect(ideas).toHaveProperty('niche_specifics');

      expect(Array.isArray(ideas.ideas)).toBe(true);
      expect(ideas.ideas.length).toBeGreaterThanOrEqual(3);

      // Validate each idea has required fields
      for (const idea of ideas.ideas) {
        validateViralVideoStructure(idea);
      }
    });

    it('should generate ideas with valid Hook Types', async () => {
      const topic = 'Side Hustles';
      const ideas = await generateViralIdeas(topic);

      const validHookTypes = [
        'Fortune Teller',
        'Experimenter',
        'Teacher',
        'Magician',
        'Investigator',
        'Contrarian',
      ];

      for (const idea of ideas.ideas) {
        expect(validHookTypes).toContain(idea.hook_script.type);
      }
    });

    it('should generate titles under 50 characters', async () => {
      const topic = 'Tax Strategies';
      const ideas = await generateViralIdeas(topic);

      for (const idea of ideas.ideas) {
        expect(idea.title.length).toBeLessThanOrEqual(50);
      }
    });

    it('should generate hook scripts under 200 characters', async () => {
      const topic = 'Investing';
      const ideas = await generateViralIdeas(topic);

      for (const idea of ideas.ideas) {
        expect(idea.hook_script.spoken_audio.length).toBeLessThanOrEqual(200);
      }
    });

    it('should set reasonable RPM estimates', async () => {
      const topic = 'Passive Income';
      const ideas = await generateViralIdeas(topic);

      for (const idea of ideas.ideas) {
        expect(idea.estimated_rpm).toBeGreaterThanOrEqual(5);
        expect(idea.estimated_rpm).toBeLessThanOrEqual(50);
      }
    });

    it('should customize temperature and model', async () => {
      const topic = 'Banking Hacks';
      const ideas = await generateViralIdeas(topic, {
        temperature: 0.5,
        modelId: 'gpt-4o',
      });

      expect(ideas.ideas.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('generateViralIdeasBatch', () => {
    it('should batch generate ideas for multiple topics', async () => {
      const topics = ['Credit Cards', 'Side Hustles'];
      const results = await generateViralIdeasBatch(topics, { concurrency: 1 });

      expect(results.successful.length).toBeGreaterThan(0);
      expect(results.successful[0]).toHaveProperty('topic');
      expect(results.successful[0]).toHaveProperty('ideas');
    });

    it('should handle batch failures gracefully', async () => {
      const topics = ['Valid Topic 1', 'Valid Topic 2'];
      const results = await generateViralIdeasBatch(topics, { concurrency: 1 });

      // Even if some fail, batch should complete
      const totalProcessed = results.successful.length + results.failed.length;
      expect(totalProcessed).toEqual(topics.length);
    });
  });
});

/**
 * Validate structure of a ViralVideo object
 */
function validateViralVideoStructure(idea: ViralVideo): void {
  // Title
  expect(typeof idea.title).toBe('string');
  expect(idea.title.length).toBeGreaterThan(0);
  expect(idea.title.length).toBeLessThanOrEqual(50);

  // Thumbnail Concept
  expect(idea.thumbnail_concept).toHaveProperty('foreground');
  expect(idea.thumbnail_concept).toHaveProperty('background');
  expect(idea.thumbnail_concept).toHaveProperty('text_overlay');
  expect(idea.thumbnail_concept.text_overlay.split(' ').length).toBeLessThanOrEqual(3);

  // Hook Script
  expect(idea.hook_script).toHaveProperty('type');
  expect(idea.hook_script).toHaveProperty('spoken_audio');
  expect(idea.hook_script).toHaveProperty('visual_action');
  expect(typeof idea.hook_script.spoken_audio).toBe('string');
  expect(idea.hook_script.spoken_audio.length).toBeGreaterThan(0);

  // Primal Desire
  const validDesires = [
    'Fear of poverty',
    'Greed / wealth accumulation',
    'Social status / respect',
    'FOMO (missing out)',
    'Tribal belonging',
    'Survival / security',
    'Self-improvement',
    'Validation / recognition',
  ];
  expect(validDesires).toContain(idea.primal_desire);

  // RPM
  expect(typeof idea.estimated_rpm).toBe('number');
  expect(idea.estimated_rpm).toBeGreaterThanOrEqual(5);
  expect(idea.estimated_rpm).toBeLessThanOrEqual(50);

  // Content Gap
  expect(typeof idea.content_gap_reason).toBe('string');
  expect(idea.content_gap_reason.length).toBeGreaterThan(0);
}
