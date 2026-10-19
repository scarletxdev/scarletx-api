import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE FUNCTION catalog.validate_entity_reference() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.entity_type = 'title' AND EXISTS (SELECT 1 FROM catalog.titles WHERE id = NEW.entity_id) THEN RETURN NEW; END IF;
      IF NEW.entity_type = 'studio' AND EXISTS (SELECT 1 FROM catalog.studios WHERE id = NEW.entity_id) THEN RETURN NEW; END IF;
      IF NEW.entity_type = 'person' AND EXISTS (SELECT 1 FROM catalog.people WHERE id = NEW.entity_id) THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'catalog % does not exist: %', NEW.entity_type, NEW.entity_id USING ERRCODE = 'foreign_key_violation';
    END $$`);
  for (const table of ['aliases', 'images', 'external_ids', 'provider_snapshots']) {
    pgm.sql(`CREATE CONSTRAINT TRIGGER ${table}_entity_reference AFTER INSERT OR UPDATE ON catalog.${table} DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION catalog.validate_entity_reference()`);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  for (const table of ['aliases', 'images', 'external_ids', 'provider_snapshots']) pgm.sql(`DROP TRIGGER IF EXISTS ${table}_entity_reference ON catalog.${table}`);
  pgm.sql('DROP FUNCTION IF EXISTS catalog.validate_entity_reference()');
}
