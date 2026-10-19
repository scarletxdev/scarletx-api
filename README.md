# ScarletX

Catalog ingestion service for metadata search and explicit-ID imports.

## Local start

```bash
cp .env.example .env
docker compose up -d postgres
set -a; source .env; set +a
npm install
npm run db:migrate
npm run dev
```

See [the ingestion guide](docs/ingestion.md) for API requests.

## Full catalog backfill

To import every provider change feed locally, start PostgreSQL and run:

```bash
docker compose up -d postgres
npm run backfill:local
```

The script loads `.env`, applies migrations, starts the API when needed, and
stores progress in `.scarletx-backfill.json`. Re-run the same command after an
interruption to resume. Use `npm run backfill:local -- --max=1000` to process a
bounded first run.

To prioritize a feed, pass its name: `npm run backfill:local -- --feeds=performer`.
