# Catalog ingestion

Start PostgreSQL and the service as described in the README. The API listens on
`http://localhost:3000` by default.

Search returns candidates only:

```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H 'content-type: application/json' \
  -d '{"entityType":"movie","query":"example"}'
```

Import one known external record:

```bash
curl -X POST http://localhost:3000/api/v1/ingestions/by-id \
  -H 'content-type: application/json' \
  -d '{"entityType":"movie","identity":{"provider":"tmdb","externalId":"123"}}'
```

To import selected search candidates, submit only the identities the caller
chose. The service will not import unselected search results.
