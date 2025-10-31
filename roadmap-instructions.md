# Codex Implementation Instructions for CIPL Standardizer and SLI/BOL Automation

These instructions specify how Codex should implement **every phase** in the Shipping‑Doc‑Gen roadmap. They are verbose by design and include guardrails to keep Codex efficient, safe, and on task. Execute sequentially unless parallelization is explicitly allowed. Treat each phase as independently testable and shippable.

---

## General Guardrails

- **Prefer internal connectors.** For code, issues, schemas, and roadmap context, use the GitHub connector. Use the public web only when external references are required.
- **Preserve structure and conventions.** Inspect the repo tree before adding or moving files. Conform to existing linting, formatting, and naming.
- **Batch state updates.** In React, group related state changes into a single update to avoid double renders and redundant fetches.
- **Tests are mandatory.** Every feature ships with unit tests; back‑end integrations include integration tests; critical user flows get Playwright E2E.
- **Security posture.** No secrets in code. Use env vars. Enforce least privilege, sanitize logs, validate env at startup.
- **Documentation.** Update READMEs and doc files when adding endpoints, env vars, or modules. Add JSDoc where helpful.
- **Time and locale.** Use explicit timestamps (ISO 8601) and avoid implicit local‑time behavior in persistence or exports.
- **CI contract.** Local: `npm run lint && CI=true npm test -- --watchAll=false && npm run build`. PRs must keep CI green.

---

## Phase 1 – Requirements & Schema *(Status: Completed)*

**Purpose**
- Canonical JSON is defined. Normalization rules for header and line items enumerated. Input matrix decided.

**Guardrails for future work**
- Validate inputs/outputs against the canonical schema on every boundary.
- Consult the risk register for parsing edge cases before altering extraction logic.

_No implementation required in this PR cycle; treat as reference for subsequent phases._

---

## Phase 2 – Ingestion & OCR Prototype *(Status: Not Started)*

**Goal**
- Prototype single‑file ingestion for PDF, XLSX/CSV, and DOCX; normalize to canonical JSON; produce a golden set and an accuracy report.

**Tasks**
1. **Module layout**
   - Create `ingestion/` with submodules per type: `pdf/`, `xlsx/`, `docx/`.
   - Common interface:
     ```ts
     type CanonicalDoc = { header: object; lines: object[]; checksums: object; meta: object };
     async function parseFile(buf: Buffer, fileType: 'pdf'|'xlsx'|'csv'|'docx'): Promise<CanonicalDoc>
     ```
2. **PDF parser**
   - Prefer layout‑aware extraction; fall back to OCR for scanned PDFs.
   - Capture text + layout (e.g., HOCR) for table reconstruction.
3. **Spreadsheet parser**
   - Use a robust XLSX/CSV reader. Normalize numeric fields and units.
4. **DOCX parser**
   - Extract tables; map known header sections to fields; detect line tables.
5. **Normalization**
   - Implement a normalizer that enforces units (kg, USD), trims/uppercases codes, and computes checksums.
   - Persist *raw* and *normalized* values for troubleshooting.
6. **Golden set**
   - Add `tests/golden/` with labeled examples per input type.
   - Unit tests assert parser output matches labels.
7. **Accuracy report**
   - Add `scripts/report_accuracy.(ts|js)` to compute per‑field accuracy and checksum pass/fail across golden docs.

**Guardrails**
- **Size limits:** refuse files over a configured limit (e.g., 100 MB) in prototype.
- **No arbitrary remote calls:** only the internal OCR microservice if configured.
- **Performance:** profile parsing; if > a few seconds per file, plan Phase 3 queueing.

**Deliverables**
- `ingestion/` modules + tests, golden set, and an accuracy report script.

---

## Phase 3 – Full Ingestion Pipeline *(Status: Planned)*

**Goal**
- Production‑ready ingestion with ZIP fan‑out, a job queue, OCR microservice, storage, and progress reporting.

**Tasks**
1. **Upload endpoints**
   - `POST /upload` accepts multipart files or ZIPs; ZIPs are extracted safely (no `..` paths) and each file enqueued.
2. **Job queue**
   - Use a durable queue (e.g., BullMQ). Job flow: OCR → parse → normalize → validate → persist.
   - Jobs must be **idempotent**; use a content hash as a natural key. Store intermediate artifacts (HOCR, raw text).
3. **OCR service**
   - Package as a container; expose text + bbox output. Enforce request limits and sandboxing.
4. **Storage**
   - Store originals, intermediates, and canonical JSON with signed URL access.
5. **Status API**
   - `GET /jobs/{id}` for status; `GET /documents/{id}` for canonical JSON; secure both.
6. **Progress UI**
   - WebSocket or polling for per‑stage progress: upload, OCR, parse, normalize, validate.

**Guardrails**
- **Timeouts:** cap per‑document processing time; fail with actionable errors.
- **Retries:** exponential backoff; no infinite loops.
- **Back‑pressure:** throttle uploads when queue depth is high.

**Deliverables**
- Upload UI, queue consumers, OCR integration, storage adapters, status endpoints, and operator error views.

---

## Phase 4 – Extraction & Canonical Mapping *(Status: Planned)*

**Goal**
- Mature field mappers, normalization, and **compliance validators**.

**Tasks**
1. **Field mappers**
   - Validate and coerce source values to canonical types. Derive fields (e.g., `netWeightKg`).
   - Merge duplicate lines by part number when appropriate; maintain provenance.
2. **Normalization rules**
   - Units: kg for weights, USD for values; strings trimmed and codes uppercased.
3. **Validation**
   - Assert header totals equal sum of lines; flag discrepancies.
4. **Compliance validators**
   - HTS/Schedule B existence & format checks; country‑of‑origin consistency.
   - **Error catalog**: JSON with `code`, `severity`, `message`, `suggestion`.
   - **Checksum rows**: auto‑generate and validate; record mismatches.

**Guardrails**
- Missing required fields → `valid: false` with error list, but continue processing.
- Unknown codes → warnings, not hard failures.
- Keep both `rawValue` and normalized `value` for each field.

**Deliverables**
- Normalizer + validators with unit tests and sample error catalog.

---

## Phase 5 – Backend Infra & Security *(Status: Planned)*

**Goal**
- APIs, workers, storage, **RLS**, signed URLs, env validation, and observability.

**Tasks**
1. **API service** with auth; endpoints for upload, status, docs, compliance.
2. **Storage policies** with signed URLs; helper to generate/verify URLs.
3. **Workers** for OCR, parsing, normalization, validation, export.
4. **Security hardening**
   - **RLS**: users only see their own docs.
   - **Log redaction**: strip PII/sensitive trade data.
   - **Env validation**: schema‑check required env vars at startup; exit fast on failure.
5. **Observability**
   - Metrics for queue depth, latency, error rates; dashboards and alerts.

**Guardrails**
- Least privilege DB access; explicit column selection.
- Secrets via env or secret manager only.
- Graceful degradation when dependencies are down.

**Deliverables**
- API + worker containers, security rules, env schema, and monitoring hooks.

---

## Phase 6 – Frontend UI & UX *(Status: In Progress)*

**Goal**
- Operator dashboard, document review, exports, high accessibility, and performance.

**Tasks**
1. **Doc list and filters**
   - Use saved filters and pagination. Extend contexts when adding new filters (e.g., status). Virtualize long lists.
2. **Review & edit**
   - Show diffs between raw and canonical; allow edits; store versions.
3. **Export flows**
   - Async export queue with progress and download link.
4. **Keyboard & a11y**
   - Rows focusable; arrow navigation; Enter/Space activate. `aria-busy` while loading; counts announced via `aria-live`.
5. **Validation UX**
   - Inline error messages with links to the error catalog and quick fixes.

**Guardrails**
- Debounce filter changes; **batch** updates with page reset to avoid double fetches.
- Enforce WCAG 2.2 AA; run automated a11y checks in CI.

**Deliverables**
- React components, contexts, tests, and accessibility checks.

---

## Phase 7 – SLI & BOL Generation *(Status: Planned)*

**Goal**
- Map canonical JSON to NCBFAA SLI and initial carrier BOLs; render deterministic PDFs with versioning.

**Tasks**
1. **Field mapping**
   - Store `templates/*/fieldMap.json`. Map canonical fields to template fields; support template versions.
2. **Template rendering**
   - Render HTML with the mapped data (Handlebars/JSX). No external assets at runtime.
3. **HTML → PDF**
   - Use Playwright/Puppeteer. Fix page size/margins for deterministic pagination.
4. **Carrier specifics**
   - Start with **FedEx** and **DHL** BOLs; enforce carrier constraints (length limits, required fields).
5. **Versioning & metadata**
   - Include template version in PDFs and record it with the export for reproducibility.

**Guardrails**
- Validate required fields before export; fail fast with actionable errors.
- Determinism: embed fonts or use known system fonts; bundle assets.

**Deliverables**
- Template maps, HTML templates, PDF exporter, and tests comparing pixel/text output where feasible.

---

## Phase 8 – Accounts, Collaboration & History *(Status: Planned)*

**Goal**
- Roles/permissions, audit logs, comments, edit history, and review routing.

**Tasks**
1. **Roles & permissions** enforced in API and reflected in UI.
2. **Audit log** table and admin view with filters.
3. **Comments** on documents/line items with nested threads.
4. **Edit history** with revert operations.
5. **Review workflow**: draft → in_review → approved/rejected with notifications.
6. **Multi‑tenant readiness**: `tenant_id` in tables and RLS isolation.

**Guardrails**
- Server‑side authorization for all sensitive actions.
- Rate‑limit comment/notification endpoints.

**Deliverables**
- DB migrations, backend endpoints, UI components, and tests.

---

## Phase 9 – QA & Testing *(Status: In Progress)*

**Goal**
- Comprehensive coverage; CI‑gated E2E; telemetry guardrails.

**Tasks**
1. **Unit tests** for parsers, mappers, validators, exporters.
2. **Integration tests** for ingestion pipeline paths with mocked OCR.
3. **E2E (Playwright)** required scenarios:
   - Saved filters persist across reloads.
   - Any filter change resets pagination to page 0.
   - Comma‑in‑title search returns expected rows.
   - Keyboard navigation of virtualized results works with Enter/Space activation.
4. **Telemetry guardrails** (dev only)
   - Count result‑fetch calls per filter change; warn if >1.

**Guardrails**
- Isolate tests from prod data; keep E2E under ~5 minutes with parallel runs; avoid fixed waits.

**Deliverables**
- Test suites, CI gating for E2E, and dev‑mode telemetry instrumentation.

---

## Phase 10 – Deployment & Launch *(Status: Planned)*

**Goal**
- Containerized services, CI/CD, secrets management, monitoring, and staged rollouts.

**Tasks**
1. **Dockerfiles** for API, workers, OCR; multi‑stage builds.
2. **CI/CD** to lint/test/build and build/push images; staged deploys with approvals.
3. **Secrets** via GitHub Secrets or a vault; periodic rotation.
4. **Monitoring** dashboards and alerts for latency, errors, queue depth.
5. **Beta → GA** rollout with feedback loop.

**Guardrails**
- Blue/green or canary deploys; tested rollback procedure.
- Compliance documentation for data handling if required.

**Deliverables**
- Pipelines, manifests, dashboards, runbooks.

---

## Phase 11 – Enhancements & Maintenance *(Status: Planned)*

**Goal**
- Improve OCR/extraction, expand carriers, track regulatory changes, and tune performance.

**Tasks**
1. **OCR/ML**: evaluate engines, collect misclassifications, improve layout analysis.
2. **Carrier expansion**: add UPS/USPS; factor shared utilities.
3. **Regulatory updates**: refresh HTS/Schedule B tables safely with tests.
4. **Performance**: profile ingestion; parallelize safely; cache re‑uploads by hash.
5. **Feedback loop**: collect user feedback; update roadmap regularly.

**Guardrails**
- Backward compatibility of validators/templates; migrations or version flags as needed.
- Keep docs and changelogs current.

**Deliverables**
- Incremental PRs with tests, docs, and performance notes.

---

## Deliverables Checklist (apply to every phase)

- Source code changes following project conventions
- Unit/integration/E2E tests as applicable
- Updated docs (README, API, architecture) and JSDoc
- Green CI with lint, tests, and build
- PR with clear title, body, and checklist referencing these instructions
