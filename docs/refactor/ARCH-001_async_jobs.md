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

### ARCH-001 – Async job queue

```text
Task: Implement ticket ARCH-001 (Async Job Queue for Heavy Tasks).

Scope:
- Heavy tasks: PDF generation, ZIP extraction/file processing.
- Affects upload routes and any document-generation endpoints.

Requirements:
1. Introduce a job queue library (e.g. BullMQ) wired to Redis (or an in-memory queue with a clear TODO to move to Redis).
2. Create job types:
   - `processUpload` (handles ZIP extraction + document ingestion).
   - `generatePdf` (handles PDF creation).
3. Refactor:
   - `POST /upload` (and any similar endpoints) to enqueue a job and return a Job ID immediately rather than blocking until work is done.
   - Add `GET /jobs/:id` to check status (pending/running/completed/failed) and optionally provide result/location metadata.
4. Implement basic retries and a dead-letter queue (or at least a “failed job” state that can be inspected).
5. Add tests:
   - Enqueue job -> worker processes -> status flips to completed.
   - Job failure leads to failed status and logged error.

Deliverables:
- New queue module and worker process entrypoint.
- Refactored routes to use job queue.
- Tests and short summary.
```
