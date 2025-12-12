# Shipping-Doc-Gen Application Review (Functional + Security)

## 0. System overview

- React/Vite frontend (`apps/web`) talks to Express API (`apps/api`) via bearer tokens stored in `localStorage` and sent in `Authorization` headers.
- Auth flows handled by `/auth` endpoints with JWT issuance/validation; most API routes are wrapped by `requireAuth` middleware, with role checks available via `requireRole`.
- Prisma ORM (SQLite by default) stores users, shipments, documents, parties, products, templates, forwarders, exports, and audit logs; BullMQ/Redis powers async processing for document ingestion and export.
- Document ingestion via `/upload` accepts PDF/ZIP/image/CSV uploads to local or S3 storage, validates MIME/signature, and enqueues background jobs (OCR/processing) through a queue service.
- Frontend routes are gated by a `ProtectedRoute` component and render dashboards, document review flows, address book, product library, templates, reports, and settings pages.
- PDF/CSV generation and export jobs run asynchronously and reference template maps; audit logging and comments exist on documents.

---

## 1. Functional correctness risks

### High severity

- **FUN-BE-01 – Comments endpoint creates bogus admin user**
  - `POST /documents/:id/comments` auto-upserts an `admin` user with password `'hashed_password_placeholder'` when `req.user` is absent, and ignores any `user` field from the request.
  - This hides authentication/identity failures and stores an invalid password, risking broken comment attribution and future auth collisions.
  - **Fix**: Require `req.user` for comments, reject unauthenticated requests, remove the fallback upsert path, and ensure any user creation goes through the normal auth registration flow (proper bcrypt hashing).
  - Files: `apps/api/src/routes/documents.js`

- **FUN-BE-02 – Document update/export without schema validation**
  - `PUT /documents/:id` and the export handler accept arbitrary JSON bodies without schema validation and persist/enqueue jobs based on whatever structure is provided.
  - Malformed or unexpected payloads can corrupt stored documents, break pagination, or crash export generators.
  - **Fix**: Introduce strict schema validation (e.g., Zod/Joi/Yup) for:
    - Document header
    - Line items
    - Export payload (`type`, `template`, options)
  - Files: `apps/api/src/routes/documents.js`

- **FUN-BE-03 – No per-user/tenant scoping on document queries**
  - `/documents` and related endpoints return documents without scoping to the current user/account; any authenticated user can list/read all documents and audit logs.
  - **Fix**: Add user or tenant scoping in Prisma queries and enforce ownership/ACL checks consistently across list/detail/history endpoints.
  - Files: `apps/api/src/routes/documents.js`

- **FUN-FE-01 – New shipment route unreachable**
  - `/shipments/new` uses `<ProtectedRoute>` without passing required `user`/`loading` props; it always evaluates as unauthenticated and redirects to login, blocking the new-shipment flow and bypassing expected layout/nav.
  - **Fix**: Pass `user` and `loading` into `ProtectedRoute` (and wrap in the same `Layout` as other protected routes) so the route behaves consistently.
  - Files: `apps/web/src/App.jsx`

### Medium severity

- **FUN-BE-04 – Rate limiting only applied to `/api/*`**
  - Rate limiter middleware is attached to `/api/*`, but the actual routes (e.g., `/auth/login`, `/upload`, `/shipments`) are mounted at the root without the `/api` prefix.
  - As a result, abuse protection is effectively disabled on real endpoints.
  - **Fix**: Attach the limiter to the actual route prefix in use (e.g., `/`) or to specific sensitive routes (`/auth`, `/upload`, `/documents`, `/shipments`) and align frontend base paths.

- **FUN-BE-05 – Config loader fragmentation**
  - Some modules load `config.js` (authSecret/port only) while others rely on `config/env.js`/`validateEnv()` with stricter expectations (`STORAGE_PATH`, `REDIS_*`, etc.).
  - Missing variables can crash modules at import time and create divergent behavior between environments.
  - **Fix**: Centralize configuration into a single validated module that:
    - Loads and validates required env vars.
    - Provides safe defaults for dev/test.
    - Is imported everywhere instead of ad hoc config or direct `process.env` reads.

- **FUN-BE-06 – Extra PrismaClient instance in files route**
  - `apps/api/src/routes/files.js` creates a new `PrismaClient` instance instead of reusing a shared singleton.
  - Under load, this can exhaust connections or leak resources.
  - **Fix**: Export a single Prisma client from a shared module and import it wherever needed, including `files.js`.

- **FUN-BE-07 – Storage provider mismatch for S3**
  - `S3Provider.getFilePath` throws while downstream consumers assume a local file path for PDF/CSV generation.
  - Deployments using `STORAGE_PROVIDER=s3` will crash when generating or accessing exports.
  - **Fix**: Either:
    - Refactor consumers to support streaming from S3 (URL or stream), or
    - Explicitly disallow S3 provider until those consumers are updated, with a clear runtime error and documentation.

- **FUN-BE-08 – Document filters applied post-query**
  - `/documents` applies value/carrier filters after fetching a page of results, leading to:
    - Fewer than expected items per page.
    - Inaccurate `total` counts.
  - **Fix**: Push filters down into the Prisma query or recompute pagination/total accurately after filtering.

- **FUN-FE-02 – Auth check bypasses API client base URL**
  - `checkAuth` uses `fetch('/auth/me')` directly while other calls go through a configured `API_URL` and shared client.
  - Without a dev proxy, this can call the wrong origin and bypass shared headers, failing in production.
  - **Fix**: Use the same `api.request('/auth/me')` helper or prefix with `API_URL` to ensure consistent base URL and headers.

- **FUN-FE-03 – Weak API error UX**
  - Shared `request` helper throws developer-oriented messages (e.g., “DEBUG: No authentication token found”) and many components do not catch these errors.
  - This leads to uncaught promise rejections and confusing UX.
  - **Fix**: Normalize errors in the API client (mapping to user-friendly messages) and ensure page-level components wrap calls in `try/catch` with visible notifications/toasts.

### Low severity

- **FUN-FE-04 – Auth persistence, UX gaps**
  - `checkAuth` handles token presence but does not support refresh or provide user-facing feedback on token expiry.
  - Users may be dropped to login without explanation.
  - **Fix**: Add a refresh/reauth strategy or at least an “your session expired” UX pattern.

---

## 2. Security review (OWASP-style)

### 2.1 Input validation & output encoding

- Many JSON bodies (especially document update/export) are accepted and persisted without schema-level validation.
- Comments are stored verbatim without length or content constraints.
- Upload validation relies on MIME/signature checks but does not inspect nested ZIP contents or CSV semantics.

**Findings**

- **SEC-01 – High: Missing validation on document update/export**
  - `PUT /documents/:id` and `POST /documents/:id/export` accept arbitrary structures which later drive templating and exports.
  - Risk: Crashes, corrupted data, or template injection.
  - **Mitigation**: Add strong schema validation (Zod/Joi/etc.) and enum-based whitelists for template types and export options.

- **SEC-02 – Medium: Unbounded comment body**
  - Comment `text` field is stored without length or sanitization; if rendered without escaping, this risks HTML/script injection.
  - **Mitigation**: Enforce reasonable length limits, reject dangerous content, and escape or sanitize on render.

### 2.2 Authentication & authorization

- JWT-based auth with `requireAuth`.
- Role middleware (`requireRole`) exists but is underused.

**Findings**

- **SEC-03 – High: Comments endpoint bypasses auth and creates admin**
  - Same as FUN-BE-01 but from a security perspective.
  - Risk: Unauthenticated users can write comments; placeholder `admin` user is created with a bogus password.
  - **Mitigation**: Require authenticated identity; remove fallback admin creation; only create users through normal registration.

- **SEC-04 – High: No ownership/tenant scoping for core data**
  - Same as FUN-BE-03 from a security perspective.
  - Any authenticated user can read documents/audit logs not belonging to them.
  - **Mitigation**: Apply per-user or per-tenant scoping for all sensitive resources.

- **SEC-05 – Medium: No role enforcement on admin/config routes**
  - Routes that mutate templates, forwarders, ERP config, etc. do not enforce `requireRole('admin')`.
  - **Mitigation**: Require appropriate roles for configuration and operational data endpoints.

### 2.3 Session management & CORS

- JWT tokens stored in `localStorage`.
- CORS is configured with `origin: true` and `credentials: true`, effectively reflecting any origin.

**Findings**

- **SEC-06 – High: Permissive CORS with credentials**
  - Any origin can be allowed, and credentials are enabled, enabling cross-site requests to read protected resources if a token is present.
  - Combined with `localStorage` storage, this is a significant risk.
  - **Mitigation**:
    - Restrict `origin` to a known whitelist of frontend domains.
    - Consider disabling `credentials` when not needed, or moving to httpOnly cookies with SameSite where appropriate.

- **SEC-07 – Medium: Token revocation/rotation gaps**
  - Tokens have a 24h lifetime; logout only clears local storage client-side; there is no server-side revocation or rotation.
  - **Mitigation**: For higher-risk environments, implement token revocation/rotation or shorten TTL and rely on refresh tokens.

### 2.4 Access control & least privilege

- Aside from `/files`, most routes rely only on auth, not authorization.
- File downloads and document listing are not carefully scoped.

**Findings**

- **SEC-08 – Medium: File download enumeration and weak logging**
  - File download authorization checks ownership/role but:
    - Filenames/IDs may be guessable.
    - Logging is minimal.
    - No rate limiting on downloads.
  - **Mitigation**: Use opaque, unguessable storage keys; add request logging with user context; apply rate limiting on download endpoints.

### 2.5 Cryptography & sensitive data

- Bcrypt for passwords; JWT secret from env.

**Findings**

- **SEC-09 – High: Unsafe password handling for fallback admin**
  - Same as FUN-BE-01/SEC-03 but framed as a crypto issue:
    - Hardcoded placeholder password bypasses bcrypt and would be flagged as a hardcoded credential.
  - **Mitigation**: Remove fallback and ensure all password writes pass through hashing logic.

- **SEC-10 – Medium: S3 client initialization without security defaults**
  - S3 uploads are configured with raw `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and no explicit server-side encryption or content-type enforcement.
  - **Mitigation**: Document key management and enable server-side encryption (KMS/SSE-S3) and proper `ContentType` settings for uploads.

### 2.6 Error handling & logging

- Global error handler exists but many endpoints leak raw `error.message` to clients.
- Upload route logs detailed errors to console.

**Findings**

- **SEC-11 – Medium: Detailed internal errors exposed**
  - Certain endpoints (e.g., upload, auth) return internal details (e.g., signature mismatch, “username already exists”) directly to clients.
  - Risk: user enumeration and leaking operational details.
  - **Mitigation**: Return generic error messages from auth and sensitive endpoints; log detailed context server-side only.

### 2.7 Dependency & configuration security

- Mixed configuration loading patterns.
- No obvious dependency audit tooling in-repo.

**Findings**

- **SEC-12 – Medium: Environment validation too rigid for non-prod**
  - `config/env.js` requires Redis-related variables unconditionally, causing crashes for local/dev setups where Redis/BullMQ may not be used.
  - This can push developers toward unsafe defaults or hardcoded fallbacks.
  - **Mitigation**: Centralize config with environment-specific defaults and make Redis optional where appropriate.

### 2.8 File, path, and resource handling

- Uploads use in-memory storage with a 100MB limit.
- ZIP file contents are not inspected.

**Findings**

- **SEC-13 – Medium: In-memory uploads risk DoS**
  - Allowing up to 100MB per in-memory upload can exhaust memory under concurrent uploads.
  - **Mitigation**: Switch to disk/streaming storage, lower per-request limits, and apply per-user/per-IP quotas.

- **SEC-14 – Medium: Uninspected ZIP contents**
  - ZIP uploads are accepted and queued without inspecting nested entries, making the system vulnerable to zip bombs and oversized archives.
  - **Mitigation**: Decompress and inspect ZIP entries with size/entry limits before processing, or reject complex archives.

---

## 3. Simulated security-tool alerts

Likely SAST/dependency-check flags:

- **SAST-01 – Hardcoded credential / weak password storage**
  - Placeholder password in admin upsert.
- **SAST-02 – Wildcard CORS with credentials**
  - `origin: true` + `credentials: true` configuration.
- **SAST-03 – Missing input validation**
  - Unvalidated bodies for document update/export.
- **SAST-04 – Insecure object storage configuration**
  - S3 uploads without explicit encryption and content-type handling.
- **SAST-05 – Excessive in-memory upload size**
  - 100MB memory-based uploads without streaming.

---

## 4. Prioritized remediation plan

### 4.1 Issue table

| ID           | Area            | Severity | Summary                                                        | Suggested fix                                                                        |
| ------------ | --------------- | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| FUN-BE-01    | Backend         | High     | Comments endpoint bypasses auth and creates placeholder admin  | Require `req.user`, remove fallback admin upsert, route through hashed user records  |
| SEC-06       | Backend/Infra   | High     | CORS allows any origin with credentials                        | Restrict CORS origins to trusted domains; review credential usage and CSRF posture   |
| FUN/SEC-BE-03| Backend         | High     | No ownership/tenant scoping on documents and related data      | Add user/tenant filters and ACL checks on all document/audit endpoints               |
| FUN/SEC-BE-02| Backend         | High     | Document update/export lack schema validation                  | Enforce request schemas and template/type allowlists                                 |
| SEC-13/14    | Backend         | Medium   | ZIP uploads unchecked; large in-memory uploads                 | Inspect ZIP contents with limits; move to streaming/disk storage with smaller caps   |
| FUN-FE-01    | Frontend        | Medium   | `/shipments/new` route unusable due to missing auth props      | Pass `user`/`loading` and reuse Layout wrapper                                       |
| FUN-FE-02    | Frontend        | Medium   | Auth check uses relative fetch without shared API base         | Use shared API client or prefix with `API_URL`                                       |
| FUN-BE-04    | Backend         | Medium   | Rate limiting not applied to main routes                       | Attach limiter to actual route prefixes in use                                       |
| FUN-BE-05/SEC-12| Backend/Infra| Medium   | Divergent config loaders and rigid env validation              | Centralize config, add env-aware defaults, and consolidate env checks                |
| FUN-BE-06    | Backend         | Medium   | New `PrismaClient` in files route may exhaust connections      | Reuse a shared Prisma client singleton                                               |
| SEC-05/SEC-07| Frontend/Backend| Medium   | Token storage + revocation gaps                                | Consider httpOnly cookies or stronger XSS/CSRF defenses; assess revocation strategy  |
| SEC-10       | Backend/Infra   | Medium   | S3 uploads lack encryption/content-type hardening              | Set `ContentType` detection and `ServerSideEncryption` defaults                      |
| SEC-11       | Backend         | Low      | Error messages leak internal details and user existence        | Return generic messages; log details privately                                       |
| FUN-FE-03/04 | Frontend        | Low      | Weak error UX and session expiry handling                      | Normalize errors and add user-friendly session-expiry messages                       |

### 4.2 Top 5 next actions

1. **Fix the comments endpoint and remove the fallback admin user path**  
   - Enforce authentication, delete any placeholder admin records, and guarantee all passwords are hashed.

2. **Lock down CORS and reassess token storage strategy**  
   - Whitelist origins; decide whether to stay with bearer tokens in `localStorage` plus strong XSS/CSRF protections, or move to httpOnly cookies.

3. **Implement ownership/tenant scoping on documents and related entities**  
   - Ensure users can only see/modify data they own or are permitted to access.

4. **Add strong schema validation for document update/export flows**  
   - Validate structures before persisting or enqueuing exports to prevent crashes and data corruption.

5. **Harden file handling (ZIP and upload pipeline)**  
   - Introduce ZIP entry inspection with limits, switch to streaming/disk-based uploads with smaller size caps, and clarify S3 behavior (paths vs streams, encryption).

---
