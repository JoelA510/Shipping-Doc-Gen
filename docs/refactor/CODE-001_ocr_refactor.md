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

### CODE-001 – Refactor OCR mapper & shared schemas

```text
Task: Implement ticket CODE-001 (Refactor OCR Mapper & Shared Schemas).

Scope:
- `apps/api/src/services/import/ocrMapper.js`
- Shared schema/validation packages: `packages/schemas`, `packages/validation`, `packages/view-models`.

Requirements:
1. Replace ad-hoc objects in `ocrMapper.js` with types and schemas from `packages/schemas` (or create such schemas there if missing).
2. Centralize default values (e.g. Incoterm = "EXW", currency = "USD"):
   - Move them into a config module or constants file (e.g. `apps/api/src/config/shippingDefaults.js`).
   - Import and use those defaults in OCR mapping and anywhere else they are needed.
3. Ensure schema validation is applied:
   - After OCR mapping, validate the resulting object(s) against the canonical shipment/line-item schema.
   - Return clear errors if validation fails.
4. Add tests:
   - Ensure OCR mapper produces valid schema-conforming objects.
   - Ensure defaults are applied when fields are missing.

Deliverables:
- Updated `ocrMapper.js` using shared schemas.
- New config/constants module for defaults.
- Tests and short summary.
```
