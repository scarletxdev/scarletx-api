import { Pool } from 'pg';
import type { DatabaseConfig } from '../config.js';

export function createPool(config: DatabaseConfig): Pool {
  return new Pool({ connectionString: config.connectionString });
}
