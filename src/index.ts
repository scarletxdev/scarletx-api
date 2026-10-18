import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig(process.env);
const app = buildServer();

await app.listen({ host: '0.0.0.0', port: config.port });
