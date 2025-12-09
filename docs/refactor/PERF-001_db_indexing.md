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

### PERF-001 – Database indexing

```text
Task: Implement ticket PERF-001 (Database Indexing).

Scope:
- File: `apps/api/prisma/schema.prisma`.
- Audit report indicates missing indexes on key foreign keys and frequently queried fields.

Requirements:
1. Add `@@index` annotations for:
   - `DocumentTemplate.userId`
   - `Notification.userId`
   - `CarrierAccount.userId`
   - `ShipmentCarrierMeta.shipmentId`
   - Any other obvious FK fields used in `where` clauses in routes/services (inspect API code to confirm).
2. Ensure that existing unique constraints or relations are not broken.
3. Run `prisma migrate dev` (or generate a migration) and ensure it compiles cleanly.
4. If there are integration tests relying on the schema, ensure they still pass.

Deliverables:
- Updated Prisma schema with indexes.
- Any new migration files.
- Short markdown summary describing which indexes were added and why.
```
