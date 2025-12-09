## 1. Global working instructions for Gemini (once per session)

```text
You are working in the GitHub repo `JoelA510/Shipping-Doc-Gen` on the `main` branch (or a feature branch I create). 

Context:
- Back end: `apps/api` (Node/Express + Prisma/SQLite).
- Front end: `apps/web` (React + Vite).
- DB schema: `apps/api/prisma/schema.prisma`.
- Key services: file upload (`apps/api/src/routes/upload.js`), static files, PDF generation (`apps/api/src/services/generator.js`), carrier rates/booking (`apps/api/src/routes/carriers.js`), auth middleware (`apps/api/src/middleware/auth.js`).

We have a set of refactoring tickets (SEC-001.., PERF-001.., COST-001.., ARCH-001.., CODE-001..). For this task, focus only on the ticket(s) I specify. Do not start work on unrelated tickets.

General rules:
- Make small, focused changes scoped to the ticket.
- Keep all existing behavior unless explicitly improving it for security/performance.
- Add or update tests where reasonable to cover the change.
- Run the existing test suite and ensure it passes.
- Update any relevant docs in `docs/` if behavior changes.
- Explain your changes in a descriptive markdown summary file, placed in `docs/refactor/summaries/`, that may be used as a PR description.
```

### COST-002 – Carrier rate caching

```text
Task: Implement ticket COST-002 (Carrier Rate Caching).

Scope:
- File: `apps/api/src/routes/carriers.js`.
- Currently rate shopping fetches fresh rates for each request.

Requirements:
1. Introduce a simple caching layer for rate quotes:
   - Prefer Redis if configuration is straightforward, otherwise start with an in-memory cache module with clear TODOs to upgrade to Redis.
2. Define a cache key based on:
   - shipmentId
   - totalWeightKg, origin/destination countries
   - carrierAccountId
3. Cache behavior:
   - On rate request: check cache first; if present and not expired, return cached rates.
   - If not present, fetch from carrier gateway, store in cache with a TTL (e.g. 5–15 minutes) and then return.
4. Ensure we still upsert `ShipmentCarrierMeta` as before.
5. Add tests:
   - One test that hits the endpoint twice and verifies only one underlying gateway call is made (mock the gateway).
   - One test that verifies cache invalidation/TTL if you can reasonably test TTL.

Deliverables:
- Updated carrier route (or a new service module) with caching logic.
- Tests verifying caching behavior.
- Short markdown summary for PR.
```
