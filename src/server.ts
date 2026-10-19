import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProviderEntityType, ProviderIdentity } from './catalog/types.js';

const identity = z.object({ provider: z.enum(['tmdb', 'tpdb', 'stashdb']), externalId: z.string().min(1) });
const entityType = z.enum(['movie', 'scene', 'performer', 'studio']);
const idRequest = z.object({ entityType, identity });
const selectedRequest = z.object({ entityType, query: z.string().min(1), selected: z.array(identity).min(1) });

type IngestionPort = { search(entityType: ProviderEntityType, query: string): Promise<unknown[]>; importById(request: { entityType: ProviderEntityType; identity: ProviderIdentity }): Promise<{ created: boolean; [key: string]: unknown }>; };
export interface ServerDependencies { ingestion?: IngestionPort; }

export function buildServer(dependencies: ServerDependencies = {}): FastifyInstance {
  const app = Fastify();

  app.get('/health', async () => ({ status: 'ok', apiVersion: 'v1' }));
  if (dependencies.ingestion) {
    app.post('/api/v1/search', async (request, reply) => {
      const parsed = z.object({ entityType, query: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: 'validation_error', details: parsed.error.flatten() });
      return dependencies.ingestion!.search(parsed.data.entityType, parsed.data.query);
    });
    app.post('/api/v1/ingestions/by-id', async (request, reply) => {
      const parsed = idRequest.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: 'validation_error', details: parsed.error.flatten() });
      const result = await dependencies.ingestion!.importById(parsed.data);
      return reply.status(result.created ? 201 : 200).send(result);
    });
    app.post('/api/v1/ingestions/selected-results', async (request, reply) => {
      const parsed = selectedRequest.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: 'validation_error', details: parsed.error.flatten() });
      const results = await Promise.all(parsed.data.selected.map(identity => dependencies.ingestion!.importById({ entityType: parsed.data.entityType, identity })));
      return reply.status(results.some(result => result.created) ? 201 : 200).send(results);
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    void reply.status(500).send({ error: 'internal_error' });
  });

  return app;
}
