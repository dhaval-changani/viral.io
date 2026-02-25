import request from 'supertest';
import { getTestApp } from './helpers/testServer';

describe('Express App', () => {
  const app = getTestApp();

  describe('GET /api/v1/health', () => {
    it('should return a health response', async () => {
      const response = await request(app).get('/api/v1/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('database');
    });
  });

  describe('GET /api/v1/nonexistent', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Route not found');
    });
  });
});
