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

### COST-001 – PDF generator optimization

```text
Task: Implement ticket COST-001 (PDF Generator Resource Optimization).

Scope:
- File: `apps/api/src/services/generator.js` (Puppeteer + Handlebars PDF engine).

Requirements:
1. Introduce a reusable Puppeteer browser instance:
   - Implement a singleton or small pool abstraction (e.g. `getBrowser()` that lazily launches one browser and reuses it).
   - Ensure proper cleanup on process exit (hook into `process.on('SIGINT')` or similar if reasonable).
2. Refactor `generatePDF` to:
   - Acquire a browser instance from the singleton/pool.
   - Create a new page, render the HTML, generate the PDF, then close the page only (not the browser).
3. Keep existing behavior (template resolution, logging, margins) intact.
4. Add tests where possible (this may be more of an integration test or at least a small abstraction test around the browser factory).
5. Ensure this design is safe for concurrent requests (no global mutable HTML state, only per-request page state).

Deliverables:
- Updated generator service with pooled/singleton browser.
- Any new abstraction file for browser management.
- Short markdown summary of the optimization and any trade-offs.
```
