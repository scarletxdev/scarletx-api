import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { CatalogRepository } from '../../src/catalog/repository.js';
import type { NormalizedCatalogRecord } from '../../src/catalog/types.js';

const pool = new Pool({ connectionString: 'postgres://scarletx:scarletx@localhost:5432/scarletx' });
afterAll(async () => pool.end());

describe('CatalogRepository', () => {
  it('writes a movie graph once and returns the same title on repeat import', async () => {
    const externalId = randomUUID();
    const record: NormalizedCatalogRecord = {
      entityType: 'movie', title: 'Repository Fixture', normalizedTitle: 'repository fixture',
      identities: [{ provider: 'tmdb', externalId }], aliases: ['Fixture Alias'], genres: ['Drama'],
      studios: [{ name: 'Fixture Studio', identity: { provider: 'stashdb', externalId: `studio-${externalId}` } }],
      credits: [{ personName: 'Fixture Performer', identity: { provider: 'stashdb', externalId: `person-${externalId}` }, role: 'performer', billingOrder: 0 }],
      images: [{ url: `https://images.example/${externalId}.jpg`, type: 'poster' }], rawPayload: { id: externalId },
    };
    const repository = new CatalogRepository(pool);

    const first = await repository.upsert(record);
    const second = await repository.upsert(record);

    expect(second.titleId).toBe(first.titleId);
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.external_ids WHERE external_id = $1`, [externalId]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.provider_snapshots WHERE entity_id = $1`, [first.titleId]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.aliases WHERE entity_id = $1`, [first.titleId]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.images WHERE entity_id = $1`, [first.titleId]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.title_genres WHERE title_id = $1`, [first.titleId]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.external_ids WHERE entity_type = 'person' AND external_id = $1`, [`person-${externalId}`]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(`SELECT count(*)::int AS count FROM catalog.external_ids WHERE entity_type = 'studio' AND external_id = $1`, [`studio-${externalId}`]))
      .resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});
