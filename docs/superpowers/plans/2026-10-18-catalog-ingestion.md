# Catalog Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a PostgreSQL-backed API that imports catalog records by trusted external ID or provider-search result.

**Architecture:** A TypeScript Fastify service owns the `/api/v1` HTTP contract. A provider adapter fetches and validates remote metadata, while an importer normalizes it and upserts it in one PostgreSQL transaction. The first milestone contains only catalog ingestion: titles, studios, people, credits, aliases, images, genres, external IDs, and source snapshots.

**Tech Stack:** Node.js 22, TypeScript 5, Fastify 5, Zod 3, PostgreSQL 16, node-postgres, node-pg-migrate, Vitest, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-10-18-media-catalog-v1-design.md`

## Global Constraints

- Use one PostgreSQL database as the system of record.
- Use UUID primary keys and `created_at` / `updated_at` timestamps.
- Keep provider identity in `catalog.external_ids`; do not encode provider IDs in core-table columns.
- Every ingestion is idempotent and records a raw JSONB provider snapshot only when its content changes.
- Never auto-merge records on display name alone.
- All catalog writes for one imported record occur in one transaction.
- The public API starts at `/api/v1` and returns `422` validation errors and `404` for unknown resources.

## Review Focus

- A repeated import with identical source data must not create duplicate titles, people, links, or snapshots. Covered in Task 4.
- A provider response that omits optional studio, performer, image, alias, or genre data must still import its title. Covered in Task 3 and Task 4.
- A malformed provider response must produce a structured upstream-data error without writing a partial catalog record. Covered in Task 3 and Task 5.
- Two different providers may identify the same real-world record; the first milestone must retain both identities without automatic name-based merging. Covered in Task 4.
- A search request must not silently import every remote result; only selected external IDs are imported. Covered in Task 5.

---

## File Structure

```text
package.json                         Scripts and dependencies
tsconfig.json                        Strict TypeScript configuration
docker-compose.yml                   Local PostgreSQL 16 service
src/config.ts                        Environment validation and configuration
src/server.ts                        Fastify app factory and error mapping
src/index.ts                         HTTP process entry point
src/db/pool.ts                       PostgreSQL connection pool
src/db/migrations/                   Ordered node-pg-migrate SQL migrations
src/catalog/types.ts                 Domain types for normalized provider records
src/catalog/normalize.ts             Provider payload to normalized domain mapping
src/catalog/repository.ts            Transactional catalog persistence
src/provider/client.ts               Remote metadata HTTP client
src/provider/schemas.ts              Zod schemas for provider payloads
src/provider/routes.ts               Supported ID and search route construction
src/ingestion/service.ts             External-ID and selected-search import workflows
src/api/ingestion-routes.ts          HTTP request/response handlers
src/api/title-routes.ts              Read back imported title records
test/helpers/postgres.ts             Disposable PostgreSQL test database
test/helpers/provider.ts             Deterministic provider HTTP stub
test/provider/client.test.ts         Provider validation and route tests
test/catalog/repository.test.ts      Transactional idempotent upsert tests
test/ingestion/service.test.ts       ID and selected-search ingestion tests
test/api/ingestion-routes.test.ts    HTTP contract tests
```

### Task 1: Bootstrap the service and local database

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `src/config.ts`
- Create: `src/db/pool.ts`
- Create: `src/server.ts`
- Create: `src/index.ts`
- Create: `test/server.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig`
- Produces: `createPool(config: DatabaseConfig): Pool`
- Produces: `buildServer(dependencies: ServerDependencies): FastifyInstance`

- [ ] **Step 1: Write the failing health-route test**

```ts
it('returns the API version from GET /health', async () => {
  const app = buildServer(testDependencies);
  const response = await app.inject({ method: 'GET', url: '/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok', apiVersion: 'v1' });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/server.test.ts`

Expected: FAIL because `buildServer` does not exist.

- [ ] **Step 3: Implement strict configuration, the PostgreSQL pool, and `buildServer`**

`loadConfig` requires `DATABASE_URL` and accepts `PORT` defaulting to `3000`.
`buildServer` registers `/health` and a JSON error handler. Do not open a
database connection during app construction.

- [ ] **Step 4: Add package scripts and Docker configuration**

Provide `dev`, `build`, `start`, `test`, `test:integration`, `db:migrate`, and
`db:rollback` scripts. Configure a PostgreSQL 16 local service with a durable
named volume and the development database URL shown in `.env.example`.

- [ ] **Step 5: Run the focused test and type check**

Run: `npm test -- test/server.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json docker-compose.yml .env.example src test/server.test.ts
git commit -m "feat: bootstrap catalog API service"
```

### Task 2: Create the catalog ingestion schema

**Files:**
- Create: `src/db/migrations/001_catalog_ingestion.ts`
- Create: `test/helpers/postgres.ts`
- Create: `test/db/catalog-schema.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from Task 1.
- Produces: PostgreSQL schemas and tables used by `CatalogRepository` in Task 4.

- [ ] **Step 1: Write the failing schema integration test**

```ts
it('enforces one provider identity per entity type and provider', async () => {
  await db.query(insertExternalIdForTitle('tmdb', '123'));
  await expect(db.query(insertExternalIdForTitle('tmdb', '123')))
    .rejects.toThrow(/unique/i);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `npm run test:integration -- test/db/catalog-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement migration `001_catalog_ingestion`**

Create the `catalog` schema and these tables:

- `titles`: UUID ID, `kind` constrained to movie/scene/series/season/episode,
  display/sort/normalized titles, synopsis, release date, runtime, status,
  language, certification, optimistic-lock version, timestamps.
- `studios` and `people`: UUID IDs, canonical and normalized names,
  disambiguation, optional biography/life dates, timestamps.
- `title_studios` and `title_credits`: relation type or role, character,
  billing order, source, composite uniqueness for logical links.
- `aliases`, `images`, `genres`, and `title_genres` with entity-target checks.
- `external_ids`: entity type, entity UUID, provider, external ID, timestamps;
  unique `(entity_type, provider, external_id)`.
- `provider_snapshots`: entity reference, provider, JSONB payload, SHA-256
  payload hash, fetched timestamp, parser version; unique provider/entity/hash.

Add B-tree relation indexes plus `pg_trgm` indexes on normalized title, person,
and studio names.

- [ ] **Step 4: Extend the integration test for foreign keys and snapshot uniqueness**

Assert a title-credit cannot reference a missing title or person and an
identical source snapshot is rejected by its unique constraint.

- [ ] **Step 5: Run migrations and integration tests**

Run: `npm run db:migrate && npm run test:integration -- test/db/catalog-schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations test/helpers/postgres.ts test/db/catalog-schema.test.ts
git commit -m "feat: add normalized catalog ingestion schema"
```

### Task 3: Fetch and normalize provider records

**Files:**
- Create: `src/catalog/types.ts`
- Create: `src/catalog/normalize.ts`
- Create: `src/provider/routes.ts`
- Create: `src/provider/schemas.ts`
- Create: `src/provider/client.ts`
- Create: `test/helpers/provider.ts`
- Create: `test/provider/client.test.ts`

**Interfaces:**
- Produces: `ProviderEntityType = 'movie' | 'scene' | 'performer' | 'studio'`
- Produces: `ProviderIdentity { provider: 'tmdb' | 'tpdb' | 'stashdb'; externalId: string }`
- Produces: `NormalizedCatalogRecord`
- Produces: `MetadataProviderClient.fetchById(identity, entityType): Promise<NormalizedCatalogRecord>`
- Produces: `MetadataProviderClient.search(entityType, query): Promise<SearchCandidate[]>`

- [ ] **Step 1: Write failing provider-client tests**

```ts
it('builds the TMDB movie ID URL and normalizes its relationships', async () => {
  providerStub.respondWith(moviePayload);

  const record = await client.fetchById(
    { provider: 'tmdb', externalId: '123' },
    'movie',
  );

  expect(providerStub.lastPath).toBe('/v4/movie/123');
  expect(record.studios).toHaveLength(1);
  expect(record.credits[0]).toMatchObject({ personName: 'Fixture Performer', role: 'performer' });
});
```

Add cases for TPDB movies, StashDB scenes, performers, studios, valid search
result mapping, omitted optional collections, and malformed payload rejection.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/provider/client.test.ts`

Expected: FAIL because `MetadataProviderClient` does not exist.

- [ ] **Step 3: Implement route selection and Zod parsing**

Support ID routes `/v4/movie/{tmdbId}`, `/v4/tpdb/movie/{tpdbId}`,
`/v4/scene/{stashId}`, `/v4/performer/{stashId}`, and `/v4/site/{stashId}`.
Support search routes for movies, scenes, performers, and studios. Keep the
base URL configurable and set a bounded timeout. Parse only fields needed by
the normalized catalog record and preserve the original response as `rawPayload`.

- [ ] **Step 4: Implement `normalizeProviderRecord(payload): NormalizedCatalogRecord`**

Normalize names for searching, collect every supplied external identity, and
express performers/crew as credits. Missing optional collections normalize to
empty arrays; a missing canonical ID or primary name is a validation error.

- [ ] **Step 5: Run provider tests and type check**

Run: `npm test -- test/provider/client.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/catalog src/provider test/helpers/provider.ts test/provider/client.test.ts
git commit -m "feat: fetch and normalize provider catalog records"
```

### Task 4: Upsert normalized records transactionally

**Files:**
- Create: `src/catalog/repository.ts`
- Create: `test/catalog/repository.test.ts`

**Interfaces:**
- Consumes: `NormalizedCatalogRecord` from Task 3 and `Pool` from Task 1.
- Produces: `CatalogRepository.upsert(record: NormalizedCatalogRecord): Promise<ImportedRecord>`
- Produces: `ImportedRecord { titleId?: string; personId?: string; studioId?: string; created: boolean; snapshotCreated: boolean }`

- [ ] **Step 1: Write the failing idempotent-upsert test**

```ts
it('writes a movie graph once and returns the same title on repeat import', async () => {
  const first = await repository.upsert(movieRecord);
  const second = await repository.upsert(movieRecord);

  expect(second.titleId).toBe(first.titleId);
  await expect(db.count('catalog.titles')).resolves.toBe(1);
  await expect(db.count('catalog.title_credits')).resolves.toBe(movieRecord.credits.length);
  await expect(db.count('catalog.provider_snapshots')).resolves.toBe(1);
});
```

Add cases that retain two provider identities for one explicitly matched entity,
update changed names/credits atomically, and roll back all writes when a bad
credit violates a database constraint.

- [ ] **Step 2: Run the focused integration test to verify it fails**

Run: `npm run test:integration -- test/catalog/repository.test.ts`

Expected: FAIL because `CatalogRepository` does not exist.

- [ ] **Step 3: Implement `CatalogRepository.upsert` in one transaction**

Resolve records by external identity only. Upsert canonical entities, replace
provider-owned relation sets deterministically, preserve locally owned fields,
and insert a snapshot only when its SHA-256 hash is new. Never look up an
existing entity by a display-name match.

- [ ] **Step 4: Run the repository test suite**

Run: `npm run test:integration -- test/catalog/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/catalog/repository.ts test/catalog/repository.test.ts
git commit -m "feat: upsert catalog records from provider data"
```

### Task 5: Expose ID and selected-search ingestion APIs

**Files:**
- Create: `src/ingestion/service.ts`
- Create: `src/api/ingestion-routes.ts`
- Create: `src/api/title-routes.ts`
- Modify: `src/server.ts`
- Create: `test/ingestion/service.test.ts`
- Create: `test/api/ingestion-routes.test.ts`

**Interfaces:**
- Consumes: `MetadataProviderClient.fetchById`, `MetadataProviderClient.search`, and `CatalogRepository.upsert`.
- Produces: `IngestionService.importById(request: ImportByIdRequest): Promise<ImportedRecord>`
- Produces: `IngestionService.search(request: SearchRequest): Promise<SearchCandidate[]>`
- Produces: `POST /api/v1/ingestions/by-id`
- Produces: `POST /api/v1/search`
- Produces: `POST /api/v1/ingestions/selected-results`
- Produces: `GET /api/v1/titles/:id`

- [ ] **Step 1: Write failing API tests**

```ts
it('imports one selected search result and does not import unselected candidates', async () => {
  providerStub.searchReturns([candidateA, candidateB]);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/ingestions/selected-results',
    payload: { entityType: 'movie', query: 'fixture', selected: [candidateA.identity] },
  });

  expect(response.statusCode).toBe(201);
  await expect(db.count('catalog.titles')).resolves.toBe(1);
});
```

Add coverage for a direct-ID import, provider `404` mapped to API `404`, invalid
body mapped to `422`, an upstream malformed response mapped to `502`, and title
readback containing credits and studios.

- [ ] **Step 2: Run focused API tests to verify they fail**

Run: `npm test -- test/ingestion/service.test.ts test/api/ingestion-routes.test.ts`

Expected: FAIL because ingestion routes do not exist.

- [ ] **Step 3: Implement the ingestion service and routes**

`POST /api/v1/search` fetches candidates only. `POST /api/v1/ingestions/by-id`
imports one explicitly supplied identity. `POST /api/v1/ingestions/selected-results`
accepts a query plus one or more selected identities and imports only those IDs.
Validate source/entity combinations before a provider request. Return `201` for
new records and `200` for idempotent re-imports.

- [ ] **Step 4: Implement title readback**

`GET /api/v1/titles/:id` returns the canonical title, external IDs, studios,
credits, aliases, images, and genres. Return `404` for an absent UUID.

- [ ] **Step 5: Run all tests, migrations, and build**

Run: `npm run db:migrate && npm test && npm run test:integration && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src test
git commit -m "feat: ingest catalog records by ID and selected search result"
```

### Task 6: Document the first ingestion workflow

**Files:**
- Modify: `README.md`
- Create: `docs/ingestion.md`
- Test: manual commands against a local PostgreSQL service

**Interfaces:**
- Consumes: HTTP API from Task 5.
- Produces: setup instructions and request examples that match the tested API.

- [ ] **Step 1: Write the documentation acceptance checklist**

Document a clean-machine path: start PostgreSQL, copy `.env.example`, run
migrations, start the service, search, select one result, import it, and read
the stored title. Include no provider credentials because this first adapter
uses only the public metadata routes.

- [ ] **Step 2: Verify every documented command against the local service**

Run: `docker compose up -d postgres && npm run db:migrate && npm run dev`

Expected: the documented search, selected-result import, and title readback
requests succeed.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/ingestion.md
git commit -m "docs: add catalog ingestion setup guide"
```

## Coverage review

This plan implements the catalog-ingestion milestone. It covers provider search,
trusted-ID ingestion, normalized catalog persistence, snapshots, API validation,
and the documented local workflow. Library scanning, acquisition, profiles,
automation, identity, change-feed synchronization, and production deployment
remain intentionally deferred to separate plans because they have independent
interfaces and failure modes.
