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
