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

### SEC-002 – Secure static file serving

```text
Task: Implement ticket SEC-002 (Secure Static File Serving).

Scope:
- Currently, generated files under `/files` are exposed via static serving without auth.
- We want an authenticated file-delivery endpoint.

Requirements:
1. Disable or remove any `express.static` that exposes `/files` directly from `apps/api/src/index.js` (or related bootstrap code).
2. Implement a new secured route, e.g. `GET /api/files/:id`:
   - Look up the file metadata by ID (e.g. via Prisma if there is a `ShipmentDocument` or similar record).
   - Ensure `req.user` is authenticated and authorized to access that file (at minimum, same user or same organization; if you can’t infer RBAC, add a clear TODO and enforce “owner only” or “admin only” semantics).
   - Stream the file content from disk to the response instead of loading it fully into memory.
3. Return appropriate status codes:
   - `404` if the file metadata or file itself does not exist.
   - `403` if the user is not allowed.
4. Add or update tests to verify:
   - Unauthorized user cannot fetch the file.
   - Authorized user can fetch and receives the correct content type/body.
5. Update any frontend usage (if present) to call the new `/api/files/:id` endpoint instead of a static path.

Deliverables:
- Updated API entrypoint and new secured file route.
- Tests validating auth and correct streaming behavior.
- Short markdown summary for PR.
```
