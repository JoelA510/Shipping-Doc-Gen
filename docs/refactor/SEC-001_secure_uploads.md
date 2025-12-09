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

### SEC-001 – Secure file uploads & ZIP handling

```text
Task: Implement ticket SEC-001 (Secure File Uploads & Zip Handling).

Scope:
- File: `apps/api/src/routes/upload.js`.
- Currently uses AdmZip synchronously and trusts extensions/MIME types.
- Goal: prevent Zip bombs, Zip Slip path traversal, and malicious uploads.

Requirements:
1. Replace AdmZip usage with a streaming ZIP parser (e.g. `yauzl` or a similar streaming library) that never loads the entire archive into memory at once.
2. Prevent Zip Slip:
   - Normalize entry paths.
   - Reject any entry whose resolved path would escape the intended extraction directory (e.g. contains `..`, absolute paths, or drive roots).
3. Add file signature checks:
   - Inspect magic numbers (file signatures) for uploaded PDFs and common image types instead of relying solely on extension/MIME.
   - Reject files whose signature does not match the declared type.
4. Enforce size and entry-count limits for ZIPs to reduce Zip Bomb risk.
5. Add/extend tests:
   - One test with a safe ZIP.
   - One test with a ZIP containing `../` paths.
   - One test with a mismatched signature file (e.g. `.pdf` but not actually a PDF).

Deliverables:
- Updated `upload` route that performs all checks before processing.
- Unit/integration tests in the existing test structure for these cases.
- Short markdown summary of changes suitable for a PR (include risks and how to roll back).
```
