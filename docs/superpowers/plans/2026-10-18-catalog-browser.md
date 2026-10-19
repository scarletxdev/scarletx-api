# Catalog Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local browser interface for catalog search, selected imports, and title readback.

**Architecture:** Fastify serves the browser entry point and static assets from `public/`. Browser-native JavaScript calls the existing relative API endpoints and renders state without another service or build pipeline.

**Tech Stack:** Fastify, TypeScript, browser JavaScript, CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-catalog-browser-design.md`

## Global Constraints

- Use existing API endpoints relative to the current origin.
- Do not add a frontend build pipeline or browser persistence.
- Keep failed requests visible without clearing search results or selections.

## Review Focus

- Empty search input returns client-side feedback and makes no request.
- A failed import preserves checked search results.
- Provider error responses surface their actionable message.
- An imported performer or studio reports success without attempting title readback.
- A title response with empty images, aliases, genres, credits, or studios renders cleanly.

---

### Task 1: Static browser delivery

**Files:**
- Create: `public/index.html`
- Create: `public/app.js`
- Create: `public/styles.css`
- Modify: `src/server.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Produces: `GET /` serving `public/index.html` and `GET /assets/*` serving browser assets.
- Consumes: Fastify application created by `buildServer`.

- [ ] **Step 1: Write the failing server test**

Add a test asserting `GET /` returns 200 and contains the catalog-search form.

- [ ] **Step 2: Run the server test to verify it fails**

Run: `npm test -- --run test/server.test.ts`
Expected: FAIL because the root route does not exist.

- [ ] **Step 3: Add the static browser entry point and server routes**

Serve `index.html`, `app.js`, and `styles.css` using paths resolved from the module directory; return 404 for other asset paths.

- [ ] **Step 4: Run the server test to verify it passes**

Run: `npm test -- --run test/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts public test/server.test.ts
git commit -m "feat: serve catalog browser"
```

### Task 2: Search and selected-result import client

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `test/browser/client.test.ts`

**Interfaces:**
- Consumes: `POST /api/v1/search`, `POST /api/v1/ingestions/selected-results`.
- Produces: `CatalogBrowser` functions `searchCatalog(form)` and `importSelected()` exposed for tests.

- [ ] **Step 1: Write failing client tests**

Test an empty query, successful candidate rendering, selected candidate import payload, and preservation of selections after a failed import.

- [ ] **Step 2: Run the client test to verify it fails**

Run: `npm test -- --run test/browser/client.test.ts`
Expected: FAIL because the browser module does not exist.

- [ ] **Step 3: Implement `CatalogBrowser.searchCatalog(form)` and `CatalogBrowser.importSelected()`**

Use `fetch` with JSON bodies, render checkboxes from returned candidates, and retain in-memory candidates and selections when an import fails.

- [ ] **Step 4: Run the client test to verify it passes**

Run: `npm test -- --run test/browser/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public test/browser/client.test.ts
git commit -m "feat: add catalog search and import controls"
```

### Task 3: Imported title detail view

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `test/browser/client.test.ts`

**Interfaces:**
- Consumes: title IDs returned by import and `GET /api/v1/titles/:id`.
- Produces: `CatalogBrowser.loadTitle(id)` and `CatalogBrowser.renderTitle(title)`.

- [ ] **Step 1: Write failing detail-view tests**

Test title detail rendering with identities, studios, credits, aliases, images, and genres, plus an empty metadata response.

- [ ] **Step 2: Run the client test to verify it fails**

Run: `npm test -- --run test/browser/client.test.ts`
Expected: FAIL because detail functions do not exist.

- [ ] **Step 3: Implement `loadTitle(id)` and `renderTitle(title)`**

Render a detail section only for title imports. Successful performer or studio imports show their identifier in the status area without fetching a title.

- [ ] **Step 4: Run the client test to verify it passes**

Run: `npm test -- --run test/browser/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

Run: `npm test && DATABASE_URL='postgres://scarletx:scarletx@localhost:5432/scarletx' npm run test:integration && npm run build`
Expected: all tests and the TypeScript check pass.

```bash
git add public test/browser/client.test.ts
git commit -m "feat: show imported title details"
```
