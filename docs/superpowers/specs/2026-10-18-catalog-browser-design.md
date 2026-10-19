# Catalog browser design

## Goal

Provide a local browser interface for searching provider metadata, selecting records, importing them, and viewing the resulting title catalog entry.

## User flow

1. A user opens the service root in a browser.
2. They choose Movie, Scene, Performer, or Studio and enter a search term.
3. The page calls `POST /api/v1/search` and displays the returned candidates with checkboxes.
4. The user selects one or more candidates and imports them through `POST /api/v1/ingestions/selected-results`.
5. For title imports, the page links to a detail view that reads `GET /api/v1/titles/:id`.
6. The detail view presents title metadata, external identities, studios, credits, aliases, images, and genres.

## Architecture

The Fastify service serves static files from a `public/` directory and exposes a root route for the browser interface. The client uses browser-native JavaScript and CSS with no frontend build pipeline. It calls the existing API endpoints relative to the current origin.

The client keeps the search response and selected candidates in browser memory. It does not store provider content in browser persistence. The import response drives status messages and title links.

## Error handling

The client shows validation, unavailable-provider, missing-record, and unexpected request failures in a visible status area. Import failures do not discard the visible search results or selections.

## Testing

Server tests verify that the root page and static assets are served. Unit tests cover client request helpers with mocked fetch responses, including successful search/import/readback and failed requests. Existing API and database tests remain the integration coverage for the interface's data source.
