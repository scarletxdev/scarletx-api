import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const pool = new Pool({ connectionString: 'postgres://scarletx:scarletx@localhost:5432/scarletx' });

beforeAll(async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
});

afterAll(async () => {
  await pool.end();
});

describe('catalog schema', () => {
  it('enforces one provider identity per entity type and provider', async () => {
    const titleId = randomUUID();
    const externalId = randomUUID();
    await pool.query(
      `INSERT INTO catalog.titles (id, kind, display_title, sort_title, normalized_title)
       VALUES ($1, 'movie', 'Fixture', 'Fixture', 'fixture')`,
      [titleId],
    );

    await pool.query(
      `INSERT INTO catalog.external_ids (entity_type, entity_id, provider, external_id)
       VALUES ('title', $1, 'tmdb', $2)`,
      [titleId, externalId],
    );

    await expect(
      pool.query(
        `INSERT INTO catalog.external_ids (entity_type, entity_id, provider, external_id)
         VALUES ('title', $1, 'tmdb', $2)`,
        [randomUUID(), externalId],
      ),
    ).rejects.toThrow(/unique/i);
  });

  it('rejects credits without their title or person', async () => {
    await expect(
      pool.query(
        `INSERT INTO catalog.title_credits (title_id, person_id, role, source)
         VALUES ($1, $2, 'performer', 'fixture')`,
        [randomUUID(), randomUUID()],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('stores each provider snapshot payload only once per entity', async () => {
    const titleId = randomUUID();
    await pool.query(
      `INSERT INTO catalog.titles (id, kind, display_title, sort_title, normalized_title)
       VALUES ($1, 'movie', 'Snapshot Fixture', 'Snapshot Fixture', 'snapshot fixture')`,
      [titleId],
    );

    const insert = () => pool.query(
      `INSERT INTO catalog.provider_snapshots
       (entity_type, entity_id, provider, payload, payload_hash, parser_version)
       VALUES ('title', $1, 'tmdb', '{"id":123}', 'fixture-hash', 'v1')`,
      [titleId],
    );

    await insert();
    await expect(insert()).rejects.toThrow(/unique/i);
  });
});
