import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { NormalizedCatalogRecord, ProviderIdentity } from './types.js';

export interface ImportedRecord { titleId?: string; personId?: string; studioId?: string; created: boolean; snapshotCreated: boolean; }

export class CatalogRepository {
  constructor(private readonly pool: Pool) {}

  async upsert(record: NormalizedCatalogRecord): Promise<ImportedRecord> {
    if (record.entityType === 'performer') return this.upsertPerson(record);
    if (record.entityType === 'studio') return this.upsertStudio(record);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const primary = record.identities[0];
      const existing = await client.query<{ entity_id: string }>(
        `SELECT entity_id FROM catalog.external_ids WHERE entity_type = 'title' AND provider = $1 AND external_id = $2`,
        [primary.provider, primary.externalId],
      );
      const titleId = existing.rows[0]?.entity_id ?? randomUUID();
      const created = !existing.rows[0];
      if (created) {
        await client.query(`INSERT INTO catalog.titles (id, kind, display_title, sort_title, normalized_title) VALUES ($1, $2, $3, $3, $4)`, [titleId, record.entityType, record.title, record.normalizedTitle]);
      } else {
        await client.query(`UPDATE catalog.titles SET display_title = $2, sort_title = $2, normalized_title = $3, version = version + 1, updated_at = now() WHERE id = $1`, [titleId, record.title, record.normalizedTitle]);
      }
      for (const identity of record.identities) await this.ensureExternalId(client, 'title', titleId, identity);
      await client.query('DELETE FROM catalog.title_credits WHERE title_id = $1 AND source = $2', [titleId, primary.provider]);
      await client.query('DELETE FROM catalog.title_studios WHERE title_id = $1 AND source = $2', [titleId, primary.provider]);
      for (const [index, studio] of record.studios.entries()) {
        const studioId = await this.ensureStudio(client, studio.name, studio.identity);
        await client.query(`INSERT INTO catalog.title_studios (title_id, studio_id, relation_type, position, source) VALUES ($1, $2, 'production', $3, $4)`, [titleId, studioId, index, primary.provider]);
      }
      for (const credit of record.credits) {
        const personId = await this.ensurePerson(client, credit.personName, credit.identity);
        await client.query(`INSERT INTO catalog.title_credits (title_id, person_id, role, character_name, billing_order, source) VALUES ($1, $2, $3, $4, $5, $6)`, [titleId, personId, credit.role, credit.character ?? null, credit.billingOrder, primary.provider]);
      }
      const hash = createHash('sha256').update(JSON.stringify(record.rawPayload)).digest('hex');
      const snapshot = await client.query(`INSERT INTO catalog.provider_snapshots (entity_type, entity_id, provider, payload, payload_hash, parser_version) VALUES ('title', $1, $2, $3, $4, 'v1') ON CONFLICT DO NOTHING RETURNING id`, [titleId, primary.provider, record.rawPayload, hash]);
      await client.query('COMMIT');
      return { titleId, created, snapshotCreated: snapshot.rowCount === 1 };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async ensureExternalId(client: any, entityType: string, entityId: string, identity: ProviderIdentity) { await client.query(`INSERT INTO catalog.external_ids (entity_type, entity_id, provider, external_id) VALUES ($1, $2, $3, $4) ON CONFLICT (entity_type, provider, external_id) DO UPDATE SET entity_id = EXCLUDED.entity_id, updated_at = now()`, [entityType, entityId, identity.provider, identity.externalId]); }
  private async ensureStudio(client: any, name: string, identity?: ProviderIdentity): Promise<string> { const id = identity ? (await client.query(`SELECT entity_id FROM catalog.external_ids WHERE entity_type='studio' AND provider=$1 AND external_id=$2`, [identity.provider, identity.externalId])).rows[0]?.entity_id : undefined; const studioId = id ?? randomUUID(); if (!id) await client.query(`INSERT INTO catalog.studios (id,name,normalized_name) VALUES ($1,$2,$3)`, [studioId,name,name.toLowerCase()]); if (identity) await this.ensureExternalId(client,'studio',studioId,identity); return studioId; }
  private async ensurePerson(client: any, name: string, identity?: ProviderIdentity): Promise<string> { const id = identity ? (await client.query(`SELECT entity_id FROM catalog.external_ids WHERE entity_type='person' AND provider=$1 AND external_id=$2`, [identity.provider, identity.externalId])).rows[0]?.entity_id : undefined; const personId = id ?? randomUUID(); if (!id) await client.query(`INSERT INTO catalog.people (id,name,normalized_name) VALUES ($1,$2,$3)`, [personId,name,name.toLowerCase()]); if (identity) await this.ensureExternalId(client,'person',personId,identity); return personId; }
  private async upsertPerson(record: NormalizedCatalogRecord): Promise<ImportedRecord> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const id = await this.ensurePerson(client, record.title, record.identities[0]); await client.query('COMMIT'); return { personId: id, created: true, snapshotCreated: false }; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  private async upsertStudio(record: NormalizedCatalogRecord): Promise<ImportedRecord> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const id = await this.ensureStudio(client, record.title, record.identities[0]); await client.query('COMMIT'); return { studioId: id, created: true, snapshotCreated: false }; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
