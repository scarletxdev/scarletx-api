import Fastify, { type FastifyInstance } from 'fastify';

export function buildServer(): FastifyInstance {
  const app = Fastify();

  app.get('/health', async () => ({ status: 'ok', apiVersion: 'v1' }));

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    void reply.status(500).send({ error: 'internal_error' });
  });

  return app;
}
