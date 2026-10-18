# Media catalog v1 data-platform design

## Purpose

Build a new, fast, PostgreSQL-backed API and catalog. The public contract is a
single `/api/v1` API. It models series, seasons, episodes, movies, scenes,
studios, performers, and library/acquisition workflows as one coherent data
platform.

## Goals

- Keep catalog relationships normalized and queryable, especially performer,
  studio, and title credit relationships.
- Support a complete local-media workflow: monitored titles, files, releases,
  downloads, history, and blocklists.
- Import idempotently from metadata providers and retain raw source payloads
  for refreshes and debugging.
- Deliver low-latency catalog queries with one transactional database.
- Allow future provider and API expansion without copying provider-specific
  fields into every core table.

## Non-goals for v1

- Compatibility with an external database or HTTP contract.
- Separate database instances for catalog, library, and acquisition data.
- Premature search, analytics, or queue databases.

## Deployment topology

One PostgreSQL database is the system of record. Logical PostgreSQL schemas
organize ownership while preserving local joins and ACID transactions:

| Schema | Owns |
| --- | --- |
| `catalog` | titles, people, studios, credits, metadata, provider identity |
| `library` | folders, monitored library items, media and sidecar files |
| `acquisition` | releases, download jobs/events, blocklist entries |
| `automation` | indexers, download clients, imports, notifications, tasks, commands |
| `identity` | users, API keys, audit records |
| `app` | profiles, tags, settings, shared enum/reference data |

Splitting these into physical databases is deferred until measurements show a
specific workload needs it. Full-text search uses PostgreSQL search and trigram
indexes first. An external search index is a derived, rebuildable read model;
it must never be a catalog write dependency.

## Core catalog model

### Titles and hierarchy

`catalog.titles` is the canonical content record. `kind` is one of `series`,
`season`, `episode`, `movie`, or `scene`. It contains universally useful title
fields: UUID `id`, display and sort names, normalized name, synopsis, premiere
date, runtime, status, original language, certification, availability flags,
and created/updated timestamps.

`catalog.title_hierarchy` records a child title's parent, ordinal position,
season number, episode number, and absolute number where applicable. Its
constraints allow the expected shapes: series -> season -> episode and movie
-> scene. A title has no more than one active parent. A recursive query can
retrieve any complete work hierarchy.

`catalog.title_metadata` stores mutable or optional provider-derived fields,
including ratings, artwork references, release dates, and provider-specific
display data. It is one-to-one with a title and stays separate so core title
rows remain efficient to filter and join.

### Studios, people, and credits

`catalog.studios` contains canonical studio names, normalized/sort names,
website, status, and timestamps. `catalog.people` stores performers and crew
in one entity table, with name, aliases, disambiguation, biography, life dates,
country, and optional performer attributes. `person_type` identifies performer,
director, producer, writer, or other contributor; a person can have multiple
types.

`catalog.title_studios` relates titles to one or more studios, with a relation
type (`publisher`, `network`, `production`, or `distributor`), ordering, and
source. `catalog.title_credits` relates a person to a title with role,
character, billing order, and source. This keeps performer queries as direct
indexed joins.

`catalog.aliases` applies aliases to titles, studios, and people. `catalog.images`
stores provider image URLs, local cache state, type, language, dimensions, and
ordering. `catalog.genres` and `catalog.title_genres` provide normalized genres.

### External identity and provider preservation

`catalog.external_ids` holds `(entity_type, entity_id, provider, external_id)`
and has a unique constraint on `(entity_type, provider, external_id)`. Supported
providers initially include TPDB, TMDB, TVDB, and StashDB but are not hard-coded
as columns.

`catalog.provider_snapshots` stores an immutable JSONB payload, payload hash,
provider, entity reference, fetch time, and parser version. Imports update
canonical data and append a snapshot only when payload content changes.

## Library and acquisition model

`library.root_folders` contains managed storage roots. `library.library_items`
connect monitored ownership to one title and records root folder, relative path,
monitoring mode, quality profile, availability state, and last scan/search
timestamps. It is deliberately separate from `catalog.titles`: a catalog title
may exist before it is added to a local library.

`library.media_files` belongs to a library item and contains normalized path,
size, quality, media-info JSONB, original filename, acquisition date, and
content fingerprint. `(root_folder_id, normalized_path)` is unique. Parts,
subtitles, extras, and metadata sidecars belong in `media_file_parts`,
`subtitle_files`, `extra_files`, and `metadata_files` respectively.

`acquisition.releases` records a candidate release and its parsed title,
indexer, protocol, quality, custom-format score, seeders, published timestamp,
and raw indexer payload. `acquisition.downloads` represents one attempt to
obtain a release and tracks client, status, remote ID, timestamps, and failure
reason. `download_events` records state transitions. `blocklist_entries`
prevents a failed or rejected release from being retried.

## Application and automation model

`app.tags` supports labels; join tables attach tags to titles, people, studios,
library items, and automation configurations. `app.quality_profiles` and
`app.quality_definitions` define desired media quality. `app.settings` stores
versioned application configuration as validated JSONB records, not a wide,
unbounded config table.

`automation.indexers`, `download_clients`, `import_lists`, `notifications`,
and `scheduled_tasks` keep provider-specific settings in encrypted JSONB.
`automation.commands` records asynchronous API actions and their result.

`identity.users`, `api_keys`, and `audit_log` establish authentication and an
immutable record of user-visible mutations. API keys are stored only as hashes.

## Referential integrity and deletion

- Every table uses UUID primary keys and `created_at` / `updated_at` timestamps.
- Foreign keys restrict deletion of catalog entities with active library data.
- User-initiated title removal first removes its library item and associated
  files according to an explicit option; catalog metadata may remain as an
  unmonitored record.
- Provider snapshots and audit logs retain a nullable entity reference plus a
  stable external reference so history survives a catalog deletion.
- Import upserts are serialized per `(provider, entity_type, external_id)` and
  use the external-ID unique constraint to prevent duplicates.

## Indexing and performance

The initial schema creates B-tree indexes on all foreign keys and these access
paths: hierarchy parent/position; credit person/title; title-studio links;
external IDs; monitored library items; media file paths; active downloads; and
event/history timestamps.

GIN/trigram indexes support normalized title, studio, and person name lookups,
aliases, and full-text synopsis search. Partial indexes accelerate `monitored =
true`, missing library files, pending downloads, and active commands. Query
plans for performer + studio + availability filters are part of the performance
test suite.

## v1 HTTP API

The API uses `/api/v1`, opaque UUID identifiers, cursor pagination, field
selection, filtering, sorting, and a uniform error envelope. Main resources are:

- `/titles`, `/titles/{id}`, `/titles/{id}/children`, `/titles/{id}/credits`
- `/people`, `/people/{id}`, `/people/{id}/titles`
- `/studios`, `/studios/{id}`, `/studios/{id}/titles`
- `/library-items`, `/media-files`, `/root-folders`
- `/releases`, `/downloads`, `/blocklist`
- `/quality-profiles`, `/tags`, `/indexers`, `/download-clients`, `/settings`
- `/commands` for asynchronous scans, refreshes, searches, and imports

Create/update requests accept a version token. Updates reject stale versions
with `409 conflict`. Invalid input returns `422` with per-field details;
authentication failures return `401` or `403`; absent resources return `404`.
Provider and client failures return a command reference rather than leaving
partially applied state.

## Data ingestion and rollout strategy

1. Create PostgreSQL schemas, enum/reference tables, and catalog core tables.
2. Add library/acquisition and automation tables with foreign keys and indexes.
3. Ingest titles, studios, people, credits, files, and history from configured
   metadata and library sources through versioned adapters.
4. Match records by trusted external IDs first; create reviewable candidate
   matches only when IDs are absent. Never auto-merge purely by display name.
5. Run validation reports for orphaned hierarchy records, duplicate identities,
   unmatched credits, files without library items, and releases without titles.

## Failure handling and observability

All API writes use one transaction. Import jobs, file scans, and downloads are
commands with durable status and retry metadata. Provider failures use bounded
retry with exponential backoff; permanent parsing failures retain the snapshot
and a structured error for repair. Audit records capture principal, action,
target, request ID, and changed values.

## Verification

- Apply schema changes to an empty PostgreSQL instance and verify all constraints.
- Ingest representative catalog and library fixtures, then assert counts and relationships.
- Test idempotent provider upserts and duplicate external-ID rejection.
- Test hierarchy validity, title/studio joins, performer credits, and file-path
  uniqueness.
- Test command failure/retry behaviour and stale-update conflicts.
- Use `EXPLAIN (ANALYZE, BUFFERS)` for the principal catalog queries before
  declaring the schema performant.

