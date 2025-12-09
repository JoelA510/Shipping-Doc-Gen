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

### SEC-003 – Enforce real authentication

```text
Task: Implement ticket SEC-003 (Enforce Real Authentication).

Scope:
- `apps/api/src/middleware/auth.js`
- Frontend Supabase integration: `apps/web/src/services/supabaseClient.js` and wherever auth tokens are sent to the API.

Requirements:
1. Replace the mock `requireAuth` middleware with real JWT verification:
   - Use Supabase Admin SDK or a standard JWT library to validate the JWT provided in the `Authorization: Bearer <token>` header.
   - On success, attach a `req.user` object (id, role, email) that downstream handlers can trust.
   - On failure (missing/invalid/expired), return `401 Unauthorized`.
2. Add at least a minimal RBAC model:
   - Define a simple role system from existing user data (e.g. `role` field in `User` model).
   - Provide helpers such as `requireRole('admin')` if that makes sense, or at least ensure sensitive routes (e.g. rate shopping/booking, file download) check `req.user`.
3. Make sure the frontend sends the Supabase session token correctly to the API:
   - Wherever the frontend calls the API, ensure it includes the authenticated JWT in headers.
4. Add tests:
   - Auth middleware unit tests for valid token, invalid token, missing token.
   - One integration test hitting a protected route.

Deliverables:
- Updated auth middleware and any necessary frontend adjustments.
- Tests covering happy and failure paths.
- Short markdown summary for PR.
```
