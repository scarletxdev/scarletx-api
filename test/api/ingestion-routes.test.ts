import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('ingestion routes', () => {
  it('imports only selected search results', async () => {
    const search = vi.fn().mockResolvedValue([
      { title: 'A', entityType: 'movie', identity: { provider: 'tmdb', externalId: '1' } },
      { title: 'B', entityType: 'movie', identity: { provider: 'tmdb', externalId: '2' } },
    ]);
    const importById = vi.fn().mockResolvedValue({ titleId: 'title-1', created: true, snapshotCreated: true });
    const app = buildServer({ ingestion: { search, importById } });

    const response = await app.inject({ method: 'POST', url: '/api/v1/ingestions/selected-results', payload: {
      entityType: 'movie', query: 'fixture', selected: [{ provider: 'tmdb', externalId: '1' }],
    } });

    expect(response.statusCode).toBe(201);
    expect(importById).toHaveBeenCalledTimes(1);
    expect(importById).toHaveBeenCalledWith({ entityType: 'movie', identity: { provider: 'tmdb', externalId: '1' } });
  });

  it('rejects malformed request bodies', async () => {
    const app = buildServer({ ingestion: { search: vi.fn(), importById: vi.fn() } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/ingestions/by-id', payload: {} });
    expect(response.statusCode).toBe(422);
  });
});
