import type { Pool } from 'pg';

export class TitleReader {
  constructor(private readonly pool: Pool) {}
  async findById(id: string): Promise<unknown | undefined> {
    const title = await this.pool.query(`SELECT id, display_title AS "displayTitle", kind FROM catalog.titles WHERE id = $1`, [id]);
    if (!title.rows[0]) return undefined;
    const [studios, credits] = await Promise.all([
      this.pool.query(`SELECT s.name FROM catalog.title_studios ts JOIN catalog.studios s ON s.id = ts.studio_id WHERE ts.title_id = $1 ORDER BY ts.position`, [id]),
      this.pool.query(`SELECT p.name AS "personName", tc.role, tc.character_name AS character, tc.billing_order AS "billingOrder" FROM catalog.title_credits tc JOIN catalog.people p ON p.id = tc.person_id WHERE tc.title_id = $1 ORDER BY tc.billing_order`, [id]),
    ]);
    return { ...title.rows[0], studios: studios.rows, credits: credits.rows };
  }
}
