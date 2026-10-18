import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  pgm.sql('CREATE SCHEMA IF NOT EXISTS catalog');
  pgm.sql(`CREATE TABLE catalog.titles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('movie','scene','series','season','episode')),
    display_title text NOT NULL, sort_title text NOT NULL, normalized_title text NOT NULL, synopsis text,
    release_date date, runtime_minutes integer CHECK (runtime_minutes >= 0), status text, original_language text,
    certification text, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  pgm.sql(`CREATE TABLE catalog.studios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, normalized_name text NOT NULL, website text, status text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
  pgm.sql(`CREATE TABLE catalog.people (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, normalized_name text NOT NULL, disambiguation text, biography text, birth_date date, death_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
  pgm.sql(`CREATE TABLE catalog.title_studios (title_id uuid NOT NULL REFERENCES catalog.titles(id) ON DELETE CASCADE, studio_id uuid NOT NULL REFERENCES catalog.studios(id) ON DELETE RESTRICT, relation_type text NOT NULL, position integer NOT NULL DEFAULT 0, source text NOT NULL, PRIMARY KEY (title_id, studio_id, relation_type, source))`);
  pgm.sql(`CREATE TABLE catalog.title_credits (title_id uuid NOT NULL REFERENCES catalog.titles(id) ON DELETE CASCADE, person_id uuid NOT NULL REFERENCES catalog.people(id) ON DELETE RESTRICT, role text NOT NULL, character_name text, billing_order integer NOT NULL DEFAULT 0, source text NOT NULL, PRIMARY KEY (title_id, person_id, role, source))`);
  pgm.sql(`CREATE TABLE catalog.aliases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK (entity_type IN ('title','studio','person')), entity_id uuid NOT NULL, alias text NOT NULL, normalized_alias text NOT NULL, source text NOT NULL, UNIQUE (entity_type, entity_id, normalized_alias, source))`);
  pgm.sql(`CREATE TABLE catalog.images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK (entity_type IN ('title','studio','person')), entity_id uuid NOT NULL, image_type text NOT NULL, url text NOT NULL, language text, width integer, height integer, position integer NOT NULL DEFAULT 0, source text NOT NULL, UNIQUE (entity_type, entity_id, url, source))`);
  pgm.sql(`CREATE TABLE catalog.genres (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, normalized_name text NOT NULL UNIQUE)`);
  pgm.sql(`CREATE TABLE catalog.title_genres (title_id uuid NOT NULL REFERENCES catalog.titles(id) ON DELETE CASCADE, genre_id uuid NOT NULL REFERENCES catalog.genres(id) ON DELETE RESTRICT, PRIMARY KEY (title_id, genre_id))`);
  pgm.sql(`CREATE TABLE catalog.external_ids (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK (entity_type IN ('title','studio','person')), entity_id uuid NOT NULL, provider text NOT NULL, external_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (entity_type, provider, external_id))`);
  pgm.sql(`CREATE TABLE catalog.provider_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK (entity_type IN ('title','studio','person')), entity_id uuid NOT NULL, provider text NOT NULL, payload jsonb NOT NULL, payload_hash text NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), parser_version text NOT NULL, UNIQUE (entity_type, entity_id, provider, payload_hash))`);
  pgm.sql('CREATE INDEX titles_normalized_title_trgm ON catalog.titles USING gin (normalized_title gin_trgm_ops)');
  pgm.sql('CREATE INDEX people_normalized_name_trgm ON catalog.people USING gin (normalized_name gin_trgm_ops)');
  pgm.sql('CREATE INDEX studios_normalized_name_trgm ON catalog.studios USING gin (normalized_name gin_trgm_ops)');
  pgm.sql('CREATE INDEX title_credits_person_id_idx ON catalog.title_credits (person_id)');
  pgm.sql('CREATE INDEX title_studios_studio_id_idx ON catalog.title_studios (studio_id)');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP SCHEMA IF EXISTS catalog CASCADE');
}
