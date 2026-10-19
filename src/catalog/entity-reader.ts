import type { Pool } from 'pg';

export class EntityReader {
  constructor(private readonly pool: Pool, private readonly entityType: 'person' | 'studio') {}
  async list(limit: number): Promise<unknown[]> {
    const table = this.entityType === 'person' ? 'people' : 'studios';
    return (await this.pool.query(`SELECT id, name FROM catalog.${table} ORDER BY name LIMIT $1`, [limit])).rows;
  }

  async findById(id: string): Promise<unknown | undefined> {
    const table = this.entityType === 'person' ? 'people' : 'studios';
    const entity = await this.pool.query(`SELECT id, name FROM catalog.${table} WHERE id = $1`, [id]);
    if (!entity.rows[0]) return undefined;
    const [identities, aliases, images] = await Promise.all([
      this.pool.query(`SELECT provider, external_id AS "externalId" FROM catalog.external_ids WHERE entity_type = $1 AND entity_id = $2 ORDER BY provider`, [this.entityType, id]),
      this.pool.query(`SELECT alias FROM catalog.aliases WHERE entity_type = $1 AND entity_id = $2 ORDER BY alias`, [this.entityType, id]),
      this.pool.query(`SELECT url, image_type AS type, position FROM catalog.images WHERE entity_type = $1 AND entity_id = $2 ORDER BY position`, [this.entityType, id]),
    ]);
    return { ...entity.rows[0], identities: identities.rows, aliases: aliases.rows.map(row => row.alias), images: images.rows };
  }
}
