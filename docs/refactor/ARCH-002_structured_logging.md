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

### ARCH-002 – Structured logging & error handling

```text
Task: Implement ticket ARCH-002 (Structured Logging & Error Handling).

Scope:
- `apps/api/src/middleware/errorHandler.js`
- Any ad-hoc `console.error` or `console.log` calls in critical paths.

Requirements:
1. Introduce a structured logger (Pino or Winston) with:
   - A central logger instance.
   - Logging levels (info, warn, error).
   - JSON-formatted output by default.
2. Update error handler middleware to:
   - Log errors with structured fields (message, stack, route, userId if available).
   - Return a generic error response to clients (do not leak stack traces).
3. Replace scattered `console.error` calls in critical services (e.g. carrier routes, generator) with the centralized logger.
4. Add a simple integration point or placeholder for external observability (e.g. Sentry), but keep it disabled or mocked if no DSN is configured.
5. Add tests verifying that:
   - Error handler returns correct HTTP status and JSON.
   - Logger is called when throwing errors in a test route.

Deliverables:
- New logger module.
- Updated error handler and key services.
- Tests and short summary.
```
