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

  it('rejects identities unsupported by the selected entity type', async () => {
    const app = buildServer({ ingestion: { search: vi.fn(), importById: vi.fn() } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/ingestions/by-id', payload: { entityType: 'movie', identity: { provider: 'stashdb', externalId: 'x' } } });
    expect(response.statusCode).toBe(422);
  });

  it('maps provider errors to usable response status codes', async () => {
    const missing = Object.assign(new Error('missing'), { code: 'PROVIDER_NOT_FOUND' });
    const invalid = Object.assign(new Error('invalid'), { code: 'PROVIDER_PAYLOAD_INVALID' });
    const missingApp = buildServer({ ingestion: { search: vi.fn(), importById: vi.fn().mockRejectedValue(missing) } });
    const invalidApp = buildServer({ ingestion: { search: vi.fn(), importById: vi.fn().mockRejectedValue(invalid) } });
    const body = { entityType: 'movie', identity: { provider: 'tmdb', externalId: '1' } };
    expect((await missingApp.inject({ method: 'POST', url: '/api/v1/ingestions/by-id', payload: body })).statusCode).toBe(404);
    expect((await invalidApp.inject({ method: 'POST', url: '/api/v1/ingestions/by-id', payload: body })).statusCode).toBe(502);
  });

  it('returns a stored title by ID', async () => {
    const title = { id: '00000000-0000-0000-0000-000000000000', displayTitle: 'Fixture Movie', studios: [], credits: [] };
    const app = buildServer({ ingestion: { search: vi.fn(), importById: vi.fn() }, titles: { findById: vi.fn().mockResolvedValue(title) } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/titles/${title.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(title);
  });
});
