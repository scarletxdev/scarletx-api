import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { CatalogRepository } from './catalog/repository.js';
import { TitleReader } from './catalog/title-reader.js';
import { IngestionService } from './ingestion/service.js';
import { MetadataProviderClient } from './provider/client.js';
import { buildServer } from './server.js';

const config = loadConfig(process.env);
const pool = createPool(config.database);
const provider = new MetadataProviderClient({ baseUrl: process.env.METADATA_BASE_URL ?? 'https://api.whisparr.com' });
const app = buildServer({ ingestion: new IngestionService(provider, new CatalogRepository(pool)), titles: new TitleReader(pool) });

await app.listen({ host: '0.0.0.0', port: config.port });
