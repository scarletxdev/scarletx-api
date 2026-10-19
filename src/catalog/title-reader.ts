import type { Pool } from 'pg';

export class TitleReader {
  constructor(private readonly pool: Pool) {}
  async list(limit: number): Promise<unknown[]> {
    return (await this.pool.query(`SELECT id, display_title AS "displayTitle", kind FROM catalog.titles ORDER BY display_title LIMIT $1`, [limit])).rows;
  }
  async findById(id: string): Promise<unknown | undefined> {
    const title = await this.pool.query(`SELECT id, display_title AS "displayTitle", kind FROM catalog.titles WHERE id = $1`, [id]);
    if (!title.rows[0]) return undefined;
    const [studios, credits, identities, aliases, images, genres] = await Promise.all([
      this.pool.query(`SELECT s.name FROM catalog.title_studios ts JOIN catalog.studios s ON s.id = ts.studio_id WHERE ts.title_id = $1 ORDER BY ts.position`, [id]),
      this.pool.query(`SELECT p.name AS "personName", tc.role, tc.character_name AS character, tc.billing_order AS "billingOrder" FROM catalog.title_credits tc JOIN catalog.people p ON p.id = tc.person_id WHERE tc.title_id = $1 ORDER BY tc.billing_order`, [id]),
      this.pool.query(`SELECT provider, external_id AS "externalId" FROM catalog.external_ids WHERE entity_type = 'title' AND entity_id = $1 ORDER BY provider`, [id]),
      this.pool.query(`SELECT alias FROM catalog.aliases WHERE entity_type = 'title' AND entity_id = $1 ORDER BY alias`, [id]),
      this.pool.query(`SELECT url, image_type AS type, position FROM catalog.images WHERE entity_type = 'title' AND entity_id = $1 ORDER BY position`, [id]),
      this.pool.query(`SELECT g.name FROM catalog.title_genres tg JOIN catalog.genres g ON g.id = tg.genre_id WHERE tg.title_id = $1 ORDER BY g.name`, [id]),
    ]);
    return { ...title.rows[0], studios: studios.rows, credits: credits.rows, identities: identities.rows, aliases: aliases.rows.map(row => row.alias), images: images.rows, genres: genres.rows.map(row => row.name) };
  }
}
