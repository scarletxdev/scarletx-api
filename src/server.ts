import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProviderEntityType, ProviderIdentity } from './catalog/types.js';
import { supportsIdentity } from './provider/routes.js';

const identity = z.object({ provider: z.enum(['tmdb', 'tpdb', 'stashdb']), externalId: z.string().min(1) });
const entityType = z.enum(['movie', 'scene', 'performer', 'studio']);
const idRequest = z.object({ entityType, identity });
const selectedRequest = z.object({ entityType, query: z.string().min(1), selected: z.array(identity).min(1) });

type IngestionPort = { search(entityType: ProviderEntityType, query: string): Promise<unknown[]>; importById(request: { entityType: ProviderEntityType; identity: ProviderIdentity }): Promise<{ created: boolean; snapshotCreated: boolean; titleId?: string; personId?: string; studioId?: string }>; };
type Reader = { findById(id: string): Promise<unknown | undefined>; list?(limit: number): Promise<unknown[]> };
export interface ServerDependencies { ingestion?: IngestionPort; titles?: Reader; people?: Reader; studios?: Reader; }

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
      if (!supportsIdentity(parsed.data.identity, parsed.data.entityType)) return reply.status(422).send({ error: 'validation_error', details: 'Unsupported provider for entity type' });
      const result = await dependencies.ingestion!.importById(parsed.data);
      return reply.status(result.created ? 201 : 200).send(result);
    });
    app.post('/api/v1/ingestions/selected-results', async (request, reply) => {
      const parsed = selectedRequest.safeParse(request.body);
      if (!parsed.success) return reply.status(422).send({ error: 'validation_error', details: parsed.error.flatten() });
      if (parsed.data.selected.some(candidate => !supportsIdentity(candidate, parsed.data.entityType))) return reply.status(422).send({ error: 'validation_error', details: 'Unsupported provider for entity type' });
      const results = await Promise.all(parsed.data.selected.map(identity => dependencies.ingestion!.importById({ entityType: parsed.data.entityType, identity })));
      return reply.status(results.some(result => result.created) ? 201 : 200).send(results);
    });
  }
  if (dependencies.titles) {
    app.get('/api/v1/titles', async (request, reply) => {
      const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) }).safeParse(request.query);
      if (!parsed.success || !dependencies.titles!.list) return reply.status(422).send({ error: 'validation_error' });
      return dependencies.titles!.list(parsed.data.limit);
    });
    app.get('/api/v1/titles/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const title = await dependencies.titles!.findById(id);
      return title ? reply.send(title) : reply.status(404).send({ error: 'not_found' });
    });
  }
  for (const [path, reader] of [['people', dependencies.people], ['studios', dependencies.studios]] as const) {
    if (!reader) continue;
    app.get(`/api/v1/${path}`, async (request, reply) => {
      const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) }).safeParse(request.query);
      if (!parsed.success || !reader.list) return reply.status(422).send({ error: 'validation_error' });
      return reader.list(parsed.data.limit);
    });
    app.get(`/api/v1/${path}/:id`, async (request, reply) => {
      const { id } = request.params as { id: string };
      const entity = await reader.findById(id);
      return entity ? reply.send(entity) : reply.status(404).send({ error: 'not_found' });
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if ((error as { code?: string }).code === 'PROVIDER_NOT_FOUND') return void reply.status(404).send({ error: 'not_found' });
    if ((error as { code?: string }).code === 'PROVIDER_PAYLOAD_INVALID') return void reply.status(502).send({ error: 'upstream_data_error' });
    void reply.status(500).send({ error: 'internal_error' });
  });

  return app;
}
