# ExecPlan - Shipping-Doc-Gen (post-review)

## 1. Purpose and scope

This implementation pass turns the post-review findings into a phased, low-risk set of improvements that harden security, improve correctness and performance, and raise the overall reliability of Shipping-Doc-Gen without breaking existing workflows.

**In scope**

* Security and auth hardening (JWT secret handling, multi-tenant scoping, password policy, secret storage)
* Architecture changes for heavy workloads (OCR/parsing, PDF generation, job queue usage)
* Backend correctness and validation (API contracts, request validation, data model clarifications)
* Frontend correctness and UX improvements (API alignment, units, error handling, basic validation)
* Compliance guardrails at the application level (AES/DG/HTS behavior, but not full legal coverage)
* Testing and tooling (backend and frontend tests, especially for high-risk paths; CI refinements)

**Out of scope**

* Completely new product features or major UX redesigns
* Migration to real carrier/sanctions/ERP services (beyond stubs and interfaces)
* Full-blown compliance engine rework or legal sign-off on rules
* Large infra changes (e.g., moving from SQLite to Postgres, S3 migration, Kubernetes, observability stack)

## 2. Inputs from the code review

### Key findings (summary)

* **Architecture & data modeling**

  * Heavy OCR/parsing and PDF generation run synchronously in the API process, creating potential bottlenecks and poor scaling.
  * Document storage is conceptually split between `Document` and `ShipmentDocument`, but only one is actively used, leading to confusion and tech debt.
  * Some indexing and uniqueness decisions (e.g. global SKU uniqueness) don’t fully align with a multi-tenant model.

* **Backend (API, Prisma, security, robustness)**

  * JWT auth uses a hard-coded default secret if `AUTH_SECRET` is unset.
  * Multi-tenant boundaries are not consistently enforced (e.g. address book and carrier accounts not always filtered by user).
  * Sensitive integration credentials are stored as plaintext fields despite comments suggesting they should be encrypted.
  * Request validation is shallow (mostly “required/not required”) and relies on ad-hoc checks, not shared schemas.
  * Carrier rate/booking API design doesn’t fully align with frontend usage, breaking the rate-shopping flow.

* **Frontend (state management, data flow, forms, API usage)**

  * Carrier rate-shopping UI calls an API shape that doesn’t exist on the backend.
  * Weight units are ambiguous/inconsistent (UI collects lbs, backend canonicalizes kg) with no conversion, risking incorrect docs/rates.
  * Error handling is fragmented and often relies on `alert`, with no central error surface.
  * Some components (e.g. `App`) are larger than ideal but still manageable; form validation is minimal.

* **Tests & tooling**

  * Backend and ingestion services have solid, targeted tests (including security regression tests for file access).
  * Frontend and end-to-end flows have little or no automated coverage, so integration bugs slip through.
  * Multi-tenant isolation is not explicitly exercised in tests (e.g. cross-user access attempts).
  * CI runs tests and linting, but there is room to extend coverage (e.g. basic frontend integration, contract tests for key flows).

### Finding ID mapping

| ID      | Area     | Severity | Risk type          |
| ------- | -------- | -------- | ------------------ |
| SEC-01  | Backend  | High     | Security           |
| SEC-02  | Backend  | High     | Security           |
| SEC-03  | Backend  | Medium   | Security           |
| SEC-04  | Backend  | Low      | Security/Secrets   |
| ARCH-01 | Backend  | High     | Performance        |
| ARCH-02 | Data     | Medium   | Tech debt          |
| ARCH-03 | Backend  | Medium   | Performance        |
| UI-01   | Frontend | High     | Correctness        |
| UI-02   | Frontend | Medium   | UX/Correctness     |
| UI-03   | Frontend | Low      | Performance/UX     |
| UI-04   | Frontend | Low      | DX/Maintainability |
| TEST-01 | Tests    | Medium   | DX/Coverage        |

## 3. Workstreams and phases

### WS1: Architecture & data model hardening

**Intent:**
Move heavy operations (OCR, parsing, PDF generation) off the request path or into optimized flows, and clarify data modeling where current abstractions are leaky or redundant. The goal is to keep behavior intact while improving performance and conceptual clarity.

* **Phase 0 – Enablement**

  * Inventory current job queue (BullMQ) usage and document the intended processing model.
  * Add logging/metrics around OCR and PDF generation durations.
* **Phase 1 – High-severity changes**

  * Introduce asynchronous job-based OCR/parsing wiring for new uploads (while keeping synchronous path behind a flag).
  * Optimize PDF generation lifecycle (browser reuse or job-worker routing).
* **Phase 2 – Tech-debt cleanup**

  * Consolidate document models (`Document` vs `ShipmentDocument`) and adjust APIs.
  * Tighten data constraints (e.g. uniqueness scoped by user) and add missing indexes where needed.

---

### WS2: Backend correctness, validation, and security

**Intent:**
Eliminate high-risk security flaws, enforce multi-tenant isolation, and introduce robust request validation for critical endpoints. Ensure backend behavior is predictable and safe under malformed input or hostile requests.

* **Phase 0 – Enablement**

  * Centralize configuration checks (JWT secret, DB URL, etc.) and fail fast on misconfig.
  * Define validation strategy (e.g. Zod/Joi) and add helpers.
* **Phase 1 – High-severity fixes**

  * Remove JWT default secret; enforce `AUTH_SECRET`.
  * Apply user scoping to all multi-tenant queries and operations.
  * Fix carrier API contracts to align with frontend and avoid broken flows.
* **Phase 2 – Hardening & ergonomics**

  * Introduce structured validation for auth, shipments, import, and carrier endpoints.
  * Implement password policy and enforce encrypted storage for sensitive credentials.

---

### WS3: Frontend robustness and UX correctness

**Intent:**
Ensure the frontend calls the right APIs, expresses units and validations clearly, and handles errors in a consistent, user-friendly way. Improve maintainability by splitting oversized components and centralizing concerns.

* **Phase 0 – Enablement**

  * Add a simple error notification mechanism (e.g. toast or banner) and update the `api` client to use it.
  * Confirm routing and layout patterns (React Router, reusable layout components).
* **Phase 1 – High-impact fixes**

  * Align carrier rate-shopping UI with backend contracts.
  * Fix unit handling for weights (lbs vs kg) across UI and payloads.
  * Add basic client-side validation for high-impact forms (auth, shipments, parties, label creation).
* **Phase 2 – UX polish & DX**

  * Refactor large components (e.g. split `App` header/layout).
  * Tune notification polling behavior and any UX rough edges.

---

### WS4: Compliance logic alignment (HTS, DG, AES/EEI, ECCN)

**Intent:**
Make compliance behavior more explicit and predictable, without overreaching into full legal enforcement. Ensure AES/DG/HTS handling is accurate enough for the tool’s role (assistant, not authoritative engine), and surface guardrails clearly.

* **Phase 0 – Enablement**

  * Document current assumptions for AES threshold, HTS validation, DG flags, sanctions screening.
* **Phase 1 – Guardrail improvements**

  * Add server-side checks to prevent obviously non-compliant states (e.g. `aesRequired` with no `aesItn` when generating export docs, unless explicitly overridden).
  * Validate DG lines for required fields when `isDangerousGoods` is true.
* **Phase 2 – Performance & UX tweaks**

  * Batch HTS validations to avoid N+1 queries.
  * Improve UI messaging around AES/DG status and overrides.

---

### WS5: Testing, tooling, and CI

**Intent:**
Raise confidence in changes through expanded automated tests, especially around cross-layer flows (frontend↔backend) and multi-tenant boundaries. Smooth developer experience by leveraging existing CI and adding targeted checks.

* **Phase 0 – Enablement**

  * Ensure Jest/Vitest configuration for both api and web is up to date and documented.
  * Add testing fixtures for multi-user scenarios and sample shipment flows.
* **Phase 1 – Critical coverage**

  * Backend tests for user scoping and security-sensitive paths.
  * Frontend integration/e2e tests for key flows (auth, upload→review→generate).
* **Phase 2 – Regression defense**

  * Tests for carrier rate/booking contracts, compliance panels, and new validation rules.
  * Optional: add Prettier/code-style enforcement to keep diffs clean.

## 4. Prioritized backlog (implementation tasks)

> P0 = must-do (high risk / unblockers); P1 = important but can follow; P2 = nice-to-have / cleanup.

| ID        | Workstream | Priority | Effort | Area               | Summary                                                                                                                                                                      | Key files (examples)                                                                                                                         | Dependencies             |
| --------- | ---------- | -------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| SEC-01    | WS2        | P0       | S      | Backend            | Remove default JWT secret fallback and enforce presence of `AUTH_SECRET`, failing fast on startup if missing.                                                                | `apps/api/src/services/auth.js`, `apps/api/src/index.js` or config bootstrap                                                                 | None                     |
| SEC-02    | WS2        | P0       | M      | Backend/Data       | Add per-user scoping for Parties, Items, CarrierAccount, ForwarderProfile, Templates, and any other tenant data in all queries and mutations.                                | `apps/api/src/services/parties/*.js`, `apps/api/src/services/items/*.js`, `apps/api/src/routes/carriers.js`, `apps/api/prisma/schema.prisma` | SEC-01                   |
| ARCH-01A  | WS1        | P0       | L      | Backend            | Introduce asynchronous, job-based OCR/parsing for uploads using BullMQ, with a minimal job model and status tracking.                                                        | `apps/api/src/routes/import.js`, `apps/api/src/queue/*.js`, `services/ingestion/src/*.ts`                                                    | SEC-01                   |
| UI-01     | WS3        | P0       | S      | Frontend           | Fix carrier rate-shopping contract: align frontend request shape and URL with backend routes, or add a new backend endpoint for the current UI flow.                         | `apps/web/src/components/shipping/ShipmentManager.jsx`, `apps/api/src/routes/carriers.js`                                                    | None                     |
| UI-02     | WS3        | P0       | M      | Frontend/Backend   | Make units explicit and consistent for weights (lbs vs kg), including UI labels, conversions, and server expectations.                                                       | `apps/web/src/components/shipping/ShipmentManager.jsx`, `apps/api/prisma/schema.prisma`, `apps/api/src/services/documents/*`                 | None                     |
| TEST-01A  | WS5        | P0       | M      | Tests              | Add backend tests for multi-tenant scoping: verify that user A cannot see/modify user B’s parties, items, shipments, carrier accounts, or files.                             | `apps/api/tests/*.test.js`, new test helpers for multi-user setup                                                                            | SEC-02                   |
| TEST-01B  | WS5        | P0       | M      | Tests              | Add frontend integration or e2e tests for critical flows: login, upload→review, generate document, carrier rate query.                                                       | `apps/web/tests/*`, e2e harness (Cypress/Playwright) or RTL-based integration tests                                                          | UI-01, UI-02             |
| ARCH-03A  | WS1        | P1       | M      | Backend            | Optimize PDF generation by reusing a Puppeteer browser instance or routing all generation through the BullMQ worker.                                                         | `apps/api/src/services/documents/generator.js`, `apps/api/src/queue/worker.js`                                                               | ARCH-01A                 |
| SEC-03    | WS2        | P1       | S      | Backend            | Implement and enforce a basic password policy (min length + complexity) on registration, with clear error messages.                                                          | `apps/api/src/routes/auth.js`, `apps/api/src/services/auth.js`, tests                                                                        | SEC-01                   |
| SEC-04    | WS2        | P1       | M      | Backend            | Encrypt sensitive integration credentials at rest (CarrierAccount credentials/accountNumber, potentially others).                                                            | `apps/api/prisma/schema.prisma`, `apps/api/src/services/carriers/*.js`, crypto utility module                                                | SEC-01                   |
| BE-VAL-01 | WS2        | P1       | M      | Backend            | Introduce schema-based request validation (e.g. Zod/Joi) for auth, shipments create/update, import, and carrier booking routes.                                              | `apps/api/src/routes/*.js`, `apps/api/src/validation/*.ts` (new), possible reuse of shared schemas                                           | SEC-01                   |
| ARCH-02   | WS1        | P2       | M      | Data               | Consolidate `Document` and `ShipmentDocument` usage into a single canonical model and update related code paths.                                                             | `apps/api/prisma/schema.prisma`, `apps/api/src/services/documents/*`, `apps/api/src/routes/files.js`                                         | ARCH-01A, ARCH-03A       |
| DM-01     | WS1        | P2       | S/M    | Data               | Adjust uniqueness constraints to be tenant-aware (e.g. `Item` uniqueness as (userId, sku)) and add any missing indexes used in common queries.                               | `apps/api/prisma/schema.prisma`, migration files                                                                                             | SEC-02                   |
| FE-ERR-01 | WS3        | P1       | M      | Frontend           | Centralize error handling in the frontend (e.g. a toast/banner system) and update `api` client to surface errors uniformly.                                                  | `apps/web/src/services/api.js`, `apps/web/src/components/common/ErrorBoundary/Toast*.jsx` (new)                                              | None                     |
| FE-VAL-01 | WS3        | P1       | M      | Frontend           | Add client-side validation and user-friendly error messages for key forms (auth, shipments, parties, carrier label creation).                                                | `apps/web/src/components/auth/*.jsx`, `apps/web/src/components/shipments/*.jsx`, shared validation utils                                     | FE-ERR-01                |
| UI-03     | WS3        | P2       | S/M    | Frontend           | Optimize notification polling (interval, unread-only endpoint) and mark notifications read in a more UX-friendly way.                                                        | `apps/web/src/components/common/NotificationBell.jsx`, `apps/api/src/routes/notifications.js`                                                | FE-ERR-01                |
| UI-04     | WS3        | P2       | S      | Frontend           | Split `App.jsx` into smaller layout components (Header, Layout) to reduce complexity and improve testability.                                                                | `apps/web/src/App.jsx`, `apps/web/src/components/layout/Header.jsx` (new)                                                                    | None                     |
| COMP-01   | WS4        | P1       | M      | Backend/Compliance | Make AES behavior explicit: document assumptions, and add a guard so that generating export documents when `aesRequired` and missing `aesItn` requires an explicit override. | `apps/api/src/services/compliance/aesService.js`, `apps/api/src/routes/shipments.js`, UI panels                                              | BE-VAL-01                |
| COMP-02   | WS4        | P1       | S/M    | Backend/Compliance | Enforce DG field completeness when `isDangerousGoods = true` and surface clear validation errors in both API and UI.                                                         | `apps/api/src/services/validation/*`, `apps/web/src/components/compliance/DgPanel.jsx`                                                       | BE-VAL-01                |
| COMP-03   | WS4        | P2       | M      | Backend/Compliance | Batch HTS validation queries to avoid N+1 patterns, and optionally introduce simple in-process caching.                                                                      | `apps/api/src/services/validation/htsRule.js`, `apps/api/src/services/hts/*.js`                                                              | None                     |
| TEST-02   | WS5        | P1       | S      | Tests              | Add regression tests for carrier rate and booking flows to ensure contracts remain aligned between API and frontend.                                                         | `apps/api/tests/carriers.test.js`, `apps/web/tests/carrierFlow.test.tsx`                                                                     | UI-01                    |
| TEST-03   | WS5        | P2       | S      | Tests              | Add tests for new validation rules (password policy, DG requirements, AES guard) and ensure error messages are stable.                                                       | `apps/api/tests/validation.test.js`, `apps/web/tests/validation.test.tsx`                                                                    | SEC-03, COMP-01, COMP-02 |
| TOOL-01   | WS5        | P2       | S      | Infra/DX           | Add Prettier (or confirm it) and extend linting rules to backend code for consistent style and smaller diffs.                                                                | Root `package.json`, `.eslintrc.*`, `.prettierrc`                                                                                            | None                     |

## 5. Gemini 3 HR task blocks for Antigravity

> These are the top ~10 tasks to hand directly to Gemini 3 HR. Each should be 1–3 coding sessions.

---

### Task SEC-01 - Enforce JWT secret configuration

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Backend
* Key files:

  * `apps/api/src/services/auth.js`
  * `apps/api/src/index.js` (or wherever the Express app is bootstrapped)
  * `.env.example` (if present)

**Goal**

Ensure that the API never runs with a weak or default JWT secret. Remove the hard-coded fallback secret and replace it with a strict requirement that `AUTH_SECRET` be set in the environment; fail fast on startup if it is missing.

**Constraints**

* Preserve current JWT token structure (claims, expiry) unless strictly necessary to change.
* Do not break local development; instead, document or scaffold proper env configuration.
* All existing auth tests must continue to pass (with updated setup where needed).

**Implementation hints**

* In `auth.js`, remove any `|| 'default-secret-key'` pattern around `AUTH_SECRET`.
* Add a small config module (e.g. `config.js`) that reads env vars and throws an error if `AUTH_SECRET` is not set.
* Update server bootstrap to import the config module early so misconfig fails startup clearly.
* Update `.env.example` and docs to show a placeholder `AUTH_SECRET=...`.
* Adjust tests to set `AUTH_SECRET` explicitly in their environment before running.

**Acceptance criteria**

* API refuses to start when `AUTH_SECRET` is unset (clear error message in logs).
* All existing tests pass after updating test env setup.
* Manual sanity check: starting the API with a proper `AUTH_SECRET` works; removing it fails immediately.
* No references to a default secret remain in the codebase.

---

### Task SEC-02 - Enforce per-user data scoping

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Backend/Data
* Key files:

  * `apps/api/src/services/parties/*.js`
  * `apps/api/src/services/items/*.js`
  * `apps/api/src/routes/carriers.js`
  * `apps/api/src/routes/files.js`
  * `apps/api/prisma/schema.prisma`
  * `apps/api/tests/*` (for security tests)

**Goal**

Ensure that all user-owned data (Parties, Items, Shipments, CarrierAccounts, ForwarderProfiles, Documents/files, Templates) is scoped to the authenticated user. A given user should never be able to see or manipulate another user’s records via the API.

**Constraints**

* Preserve existing API shapes (URLs, payloads).
* Do not change the semantics of admin-like behavior unless clearly required (assume all users are “regular” users for now).
* Reuse the existing `req.user` information injected by auth middleware.

**Implementation hints**

* Identify all Prisma queries for user-owned models; add `where: { createdByUserId: req.user.id }` (or equivalent) as appropriate.
* For shipper/consignee/forwarder/broker Parties, ensure that list endpoints only return entries owned by the user.
* For carrier accounts, either make them global by design (then document) or scope them to `userId` consistently; pick one and enforce it.
* Strengthen file-serving routes: ensure Document/ShipmentDocument lookups join back to a shipment owned by `req.user.id`.
* Add negative tests that simulate two users and verify cross-access attempts fail with 404/403.

**Acceptance criteria**

* New tests demonstrate that user A cannot see or alter user B’s Parties, Items, Shipments, CarrierAccounts, or files.
* Existing tests pass (or are updated to respect per-user scoping).
* Manual sanity check with two different tokens shows isolated views in the UI.
* No obvious queries remain that return user-owned data without scoping by user id.

---

### Task ARCH-01A - Job-based OCR/parsing for uploads

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Backend/Architecture
* Key files:

  * `apps/api/src/routes/import.js` (or upload/import routes)
  * `apps/api/src/queue/*.js`
  * `services/ingestion/src/*.ts`
  * `apps/api/src/services/notifications/*.js` (if used for completion)

**Goal**

Refactor the upload/OCR flow so that heavy OCR/parsing runs in a BullMQ job instead of blocking the request. The upload endpoint should enqueue a job, return a job/shipment reference, and allow the UI to poll or receive a notification when parsing is complete.

**Constraints**

* Preserve the existing synchronous behavior behind a feature flag or config so you can roll out incrementally.
* Keep the ingestion logic (parsers) functionally identical; only move where they run.
* Avoid introducing race conditions (e.g. UI reading a shipment before it exists).

**Implementation hints**

* Introduce a new job type, e.g. `ingestion:parse-upload`, that takes file metadata (path or buffer reference) and user id.
* Adjust the upload route: save the file to storage and enqueue the job, returning a job id and a placeholder “pending” shipment reference (or just job id).
* In the worker, run the existing `parseFile` + mapping to `Shipment` and persist the Shipment record when done.
* Consider firing a notification on completion so the UI can show a toast; otherwise, the UI can poll a “job status” endpoint.
* Add basic logging around job lifetime (queued, processing, completed, failed).

**Acceptance criteria**

* Existing upload endpoint still works in synchronous mode when the flag is off.
* When the async mode is enabled, the API returns promptly (without waiting for OCR), and a background job completes the parse.
* New or updated tests verify that an upload enqueues a job and that jobs result in created shipments.
* Manual sanity check: upload a file, see immediate acknowledgment, and then see the parsed shipment appear once the job completes.

---

### Task UI-01 - Fix carrier rate API contract

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Frontend/Backend contract
* Key files:

  * `apps/web/src/components/shipping/ShipmentManager.jsx`
  * `apps/api/src/routes/carriers.js`
  * `apps/api/tests/carriers.test.js` (new/updated)

**Goal**

Resolve the mismatch between the frontend’s rate-shopping requests and the backend carriers routes. The UI should be able to fetch rates without errors and display them correctly, either by posting a full shipment payload or by referencing an existing shipment.

**Constraints**

* Avoid breaking any in-progress integrations; keep the existing `/carriers/:id/rates` behavior working if it’s used elsewhere.
* Prefer minimal API surface changes; if adding a new endpoint, keep it consistent with existing design.
* Respect the existing carrier gateway abstraction.

**Implementation hints**

* Decide on a contract: either (1) UI posts to `/carriers/rates` with a shipment JSON, or (2) UI creates a shipment, then calls `/carriers/:shipmentId/rates`.
* Implement (or adjust) the chosen endpoint in `carriers.js` to match the ShipmentManager’s payload shape.
* Update `ShipmentManager.jsx` to call the correct endpoint and handle the response shape (rates list, pricing, service codes).
* Add tests that assert calling the endpoint with a minimal valid payload returns mock rates successfully.
* Consider a small utility function to map a shipment object into the carrier gateway’s expected internal format.

**Acceptance criteria**

* Manual sanity check: from the UI, a user can enter shipment details and successfully see mock rates within the existing layout.
* Tests (backend and/or frontend) verify the rate endpoint returns expected data for a sample shipment.
* No regressions in any existing carrier booking behavior.
* The API responds with clear errors when required fields for rate shopping are missing.

---

### Task UI-02 - Normalize weight units (lbs vs kg)

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Frontend/Backend correctness
* Key files:

  * `apps/web/src/components/shipping/ShipmentManager.jsx`
  * `apps/web/src/components/review/*` (if they display weight)
  * `apps/api/prisma/schema.prisma`
  * `apps/api/src/services/documents/*` (where weights appear in docs)

**Goal**

Make weight units explicit and internally consistent. The frontend should clearly indicate the unit expected from the user, convert if necessary, and the backend should treat stored weights as a single canonical unit (likely kilograms).

**Constraints**

* Do not silently change existing stored weights; any migration must be deliberate if required.
* Avoid surprising users; if you switch to kg input, make it obvious in labels.
* Preserve correctness of any calculations or validations that depend on weight.

**Implementation hints**

* Confirm the canonical unit in the schema (e.g. `totalWeightKg` implies kilograms) and treat that as the source of truth.
* In `ShipmentManager.jsx` (and any other forms), either:

  * Ask for kg directly and label fields as “kg”, or
  * Allow lbs input but convert to kg before sending to the API.
* If conversion is applied, centralize it in a small utility (e.g. `lbsToKg`) and reuse.
* Verify document templates label units correctly (e.g. “kg” vs “lbs”) and adjust if needed.
* Add validation to ensure non-negative, reasonable weight values.

**Acceptance criteria**

* Manual sanity check: enter a known weight in lbs, see the correct kg equivalent stored/used (if using conversions).
* Generated docs display weights with correct units and values.
* Carrier rate shopping behaves correctly for a known test case when comparing before/after.
* Tests validate conversion correctness and that the API receives the expected unit.

---

### Task TEST-01A - Backend multi-tenant isolation tests

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Tests/Security
* Key files:

  * `apps/api/tests/*` (add or extend)
  * `apps/api/src/services/parties/*.js`
  * `apps/api/src/services/items/*.js`
  * `apps/api/src/routes/shipments.js`
  * `apps/api/src/routes/files.js`

**Goal**

Add tests that explicitly verify multi-tenant isolation: that one user cannot access another user’s data via APIs for Parties, Items, Shipments, CarrierAccounts, or files.

**Constraints**

* Assume JWT auth middleware is functioning; mocks/factories can be used to inject different `req.user` identities if needed.
* Do not overfit tests to current implementation details; focus on observable behavior (HTTP responses, returned lists).

**Implementation hints**

* Create test helpers to generate two users and associated records (shipments, parties, items, documents) using Prisma.
* Add tests covering:

  * Listing resources (e.g. `/parties`, `/items`, `/shipments`) returns only the current user’s data.
  * Fetching a specific resource id belonging to another user returns 404/403.
  * File download endpoints don’t leak other users’ documents.
* Reuse patterns from existing file access security tests as a template.
* Ensure tests run without sharing state across test cases (reset DB between tests as needed).

**Acceptance criteria**

* New tests fail if scoping is removed or misapplied, and pass with proper scoping.
* All existing backend tests still pass.
* Manual sanity check: with two different tokens in a REST client, cross-access attempts fail as expected.

---

### Task TEST-01B - Frontend integration tests for key flows

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Frontend/Tests
* Key files:

  * `apps/web/tests/*` (new)
  * `apps/web/src/App.jsx`
  * `apps/web/src/components/import/ImportPage.jsx`
  * `apps/web/src/components/review/DocumentReviewPage.jsx`
  * Test harness (Cypress/Playwright or React Testing Library setup)

**Goal**

Introduce automated frontend tests that cover key user flows end-to-end (against a dev/test API or mocked API), including login, document upload→review, document generation, and carrier rate shopping.

**Constraints**

* Keep test setup simple enough for a solo dev to maintain.
* Prefer running against a local mocked backend for deterministic behavior, unless wired to an in-memory API.

**Implementation hints**

* Pick a testing strategy:

  * Option A: Cypress/Playwright hitting a running API with a seeded DB.
  * Option B: React Testing Library + MSW to mock API responses at the network layer.
* Implement at least:

  * Auth flow: login with simple test credentials and assert navigation to dashboard.
  * Import flow: simulate file upload, then assert navigation to a review page and display of parsed data (stub response).
  * Generate document: click “generate” and assert UI indicates success and contains a link/reference to the document.
  * Carrier rates: with stubbed API, assert rate cards appear after submitting the form.
* Configure CI to run these tests with a reasonable timeout.

**Acceptance criteria**

* New test suite runs successfully via a single npm script (e.g. `npm run test:web:e2e`).
* CI runs these tests without flaky failures.
* Breaking the front/back contract for imports or carriers causes tests to fail.
* Manual sanity check: running tests locally gives clear feedback on high-level flows.

---

### Task FE-ERR-01 - Centralized frontend error handling

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Frontend/UX
* Key files:

  * `apps/web/src/services/api.js`
  * `apps/web/src/App.jsx`
  * `apps/web/src/components/common/*` (new error/notification component)

**Goal**

Introduce a centralized, user-friendly error handling mechanism in the frontend so that network and validation errors are surfaced consistently (e.g. via toasts or a banner) instead of ad hoc `alert` calls.

**Constraints**

* Avoid adding heavy UI libraries; implement a lightweight solution consistent with current styling (Tailwind).
* Do not change any API contract; only how errors are displayed.

**Implementation hints**

* Implement a simple ErrorContext or NotificationContext that can enqueue messages.
* Add a top-level component (e.g. `<GlobalToast />` or `<ErrorBanner />`) in `App.jsx` that subscribes to this context and renders messages.
* Modify `api.js` to catch non-OK responses, parse error payloads, and throw a structured error object; optionally, this module can also push messages into the context.
* Replace direct `alert()` usages with calls into the error context hook.
* Ensure errors from key flows (upload, generate, carriers) are easy for the user to understand.

**Acceptance criteria**

* Manual sanity check: force a backend error (e.g. stop the API or hit an invalid route) and see a clear error message in the UI, not a raw JS alert.
* No remaining `window.alert` calls for user-facing errors (except maybe for very rare fallback conditions).
* New tests (if any) confirm that error context shows messages when the API returns error responses.

---

### Task FE-VAL-01 - Client-side validation for key forms

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Frontend/Validation
* Key files:

  * `apps/web/src/components/auth/Login.jsx` / Register components
  * `apps/web/src/components/shipments/*.jsx`
  * `apps/web/src/components/parties/*.jsx`
  * Shared validation utils (new file)

**Goal**

Add basic client-side validation for the most important forms (auth, shipments, parties, carrier label creation), providing immediate feedback and preventing obviously invalid submissions before hitting the API.

**Constraints**

* Keep validation rules aligned with backend expectations; avoid conflicts between front and back.
* Use a minimal dependency set; if a validation library is used, prefer something lightweight or reuse Zod if already present.

**Implementation hints**

* Define reusable validation functions/schemas (e.g. `validateRequired`, email pattern, min length for certain fields).
* Integrate validation into form submit handlers, surfacing errors inline under fields or at top of the form.
* Ensure that existing backend errors are still handled and displayed (for cases where the backend rejects even after client validation).
* Consider using a small hook (e.g. `useFormValidation`) to avoid repeating logic across forms.
* Start with minimal rules: required fields, basic formats, non-negative numbers.

**Acceptance criteria**

* Manual sanity check: leaving required fields empty prevents submission and shows clear messages.
* Submitting data that passes client validation but is rejected by the server still shows a meaningful error (via FE-ERR-01).
* Tests (front-end) cover at least one form’s validation behavior (e.g. login, create party).

---

### Task ARCH-03A - Optimize PDF generation lifecycle

**Context for Gemini**

* Repo: [https://github.com/JoelA510/Shipping-Doc-Gen](https://github.com/JoelA510/Shipping-Doc-Gen)
* Relevant area: Backend/Performance
* Key files:

  * `apps/api/src/services/documents/generator.js`
  * `apps/api/src/queue/worker.js`
  * Any shared Puppeteer utility (if present or to be created)

**Goal**

Reduce resource overhead for PDF generation by reusing a Puppeteer browser instance where practical or moving all document generation into the job worker to avoid repeated browser startups on the request path.

**Constraints**

* Preserve the output format of generated documents (PDF contents and filenames).
* Handle browser failures gracefully (e.g. recreate browser if it crashes).
* Avoid blocking request handler threads with heavy CPU-bound operations.

**Implementation hints**

* Identify all code paths that call `puppeteer.launch()` directly and centralize this behavior into a singleton utility (e.g. `getBrowser()`).
* Prefer routing synchronous requests through the existing BullMQ worker: enqueue a PDF generation job and either wait for completion (for small loads) or return a job reference.
* Implement a simple retry mechanism if the browser instance is closed or crashes.
* Add logging around PDF generation timing and browser lifecycle events for future tuning.
* Add tests that mock Puppeteer to verify appropriate calls without launching a real browser in test.

**Acceptance criteria**

* Manual sanity check: document generation still works end-to-end (user can generate a PDF and download it).
* Log/metrics show reduced frequency of browser launches (ideally one per process lifetime).
* No regressions in document appearance or file metadata.
* Tests pass and are not significantly slower due to Puppeteer usage (use mocks where needed).

---

## 6. Execution order and batching strategy

**Recommended order of workstreams/phases**

1. **WS2 Phase 1 (Backend security and correctness)**

   * Do `SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`, `BE-VAL-01` early. These changes eliminate high-risk security and correctness issues; they also give the backend a more stable surface for later work.
2. **WS1 Phase 1 (Architecture/OCR/PDF)**

   * Implement `ARCH-01A` and `ARCH-03A` once security is solid. This touches core flows (upload and document generation), so having good tests (WS5) is important before and after.
3. **WS3 Phase 1 (Frontend correctness & UX)**

   * Fix carrier contract (`UI-01`), unit consistency (`UI-02`), and add validation/error handling (`FE-ERR-01`, `FE-VAL-01`) so the frontend becomes more trustworthy and self-explanatory.
4. **WS5 Phase 1 (Testing)**

   * While doing the above, or immediately after, introduce `TEST-01A`, `TEST-01B`, and `TEST-02` to cover multi-tenant isolation and key flows. This should be interleaved as you touch relevant areas.
5. **WS4 Phase 1 (Compliance guardrails)**

   * Once core behavior is stable, apply `COMP-01` and `COMP-02` to avoid obviously non-compliant states and make compliance intent explicit.
6. **Phases 2 (all workstreams)**

   * Tackle tech-debt and polish tasks (`ARCH-02`, `DM-01`, `UI-03`, `UI-04`, `COMP-03`, `TEST-03`, `TOOL-01`) in follow-up PRs as capacity allows.

**Batching into PRs**

* **PR 1 – Security Core:** `SEC-01`, `SEC-03`, env/config docs. Small, focused, easy to review and revert if needed.
* **PR 2 – Multi-tenant Scoping + Tests:** `SEC-02`, `TEST-01A`, some of `BE-VAL-01` where necessary (e.g. ensuring user id is always present). Keep it backend-only.
* **PR 3 – Carrier & Unit Fixes:** `UI-01`, `UI-02`, `TEST-02`. This is the main contract-alignment PR between frontend and backend; run e2e tests here.
* **PR 4 – Async OCR & PDF Optimizations:** `ARCH-01A`, `ARCH-03A`. Gate new behavior behind a feature flag; keep the PR focused on architecture and queue wiring.
* **PR 5 – Frontend UX & Validation:** `FE-ERR-01`, `FE-VAL-01`, possibly initial `TEST-01B` coverage for forms.
* **PR 6 – Compliance Guardrails:** `COMP-01`, `COMP-02` plus tests (`TEST-03` subset).
* **PR 7+ – Cleanup & Tech Debt:** `ARCH-02`, `DM-01`, `UI-03`, `UI-04`, `COMP-03`, `TOOL-01`.

**Pre-flight tasks**

* Ensure you can run all test suites locally (API + web) and they pass before starting.
* Confirm a clean DB reset/migration workflow (Prisma migrations, seed) to support new tests and data model changes.
* For anything touching Prisma schema (e.g. `DM-01`, `ARCH-02`), create separate migrations and run them on a throwaway DB first; do not mix schema changes with unrelated code in a PR.

## 7. Risks, unknowns, and follow-ups

**Residual risks not fully addressed**

* **OCR accuracy and generalization:** Moving OCR to async improves performance but does not improve extraction accuracy; production documents may still need parser tuning and format-specific logic.
* **Compliance completeness:** AES/DG/HTS logic remains intentionally simplified. This plan adds guardrails but does not bring the system to a full legal/compliance engine; export officers still need to review.
* **Scaling beyond SQLite/local file storage:** The plan doesn’t include migrating DB/storage to production-grade infra (Postgres, S3). Performance and concurrency limits will still exist at higher scale.

**Unknowns requiring inspection**

* **Production environment configuration:** Actual `AUTH_SECRET`, DB type, file storage paths, and whether multiple instances run behind a load balancer.
* **Real-world document variability:** Types and formats of CIPLs currently processed in production; volume and size distribution of uploads.
* **User roles and tenancy model:** Whether there is or will be an admin role with broader visibility, and whether multi-tenant (per-company) isolation is required beyond user scoping.

**Suggested follow-up Deep Research / Gemini tasks**

* **Compliance-focused pass:** Once guardrails in WS4 are implemented, run a focused deep-dive on AES/DG/HTS logic against current US regulations and internal practices, and design a roadmap if the app is expected to be relied upon for compliance decisions.
* **Scalability & infra roadmap:** Design a migration plan to Postgres and S3 (or equivalent) with minimal downtime, including connection pooling, migrations, and file URL changes.
* **Parsing/ingestion tuning:** Collect anonymized stats about OCR failures and manual corrections, then design targeted improvements to the ingestion pipeline (e.g. layout-based table detection, better header/line heuristics).
* **UX research tasks:** Once validation and error handling are in place, gather user feedback on review flows and identify opportunities for further UX improvements (e.g. bulk edit, better validation summaries).

This plan should be directly usable as `PLANS.md` and as a task source for Gemini 3 High Reasoning in Antigravity.
