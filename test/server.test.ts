import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

describe('health endpoint', () => {
  it('returns the API version from GET /health', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', apiVersion: 'v1' });
  });
});
