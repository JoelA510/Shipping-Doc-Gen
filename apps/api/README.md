# API Workspace

Node.js 22 service responsible for ingestion orchestration, canonical shipment CRUD, exports, and Supabase integration.

## Planned Structure
- `src/modules/ingestion` for upload endpoints, queue producers, and job tracking.
- `src/modules/shipments` for canonical CRUD + validation.
- `src/modules/exports` for template selection, renderer orchestration, and artifact storage.
- `src/modules/auth` for Supabase JWT verification and RBAC enforcement.
- `tests/` for Jest or Vitest-based unit/integration coverage.

## Phase 1 Actions
- Bootstrap Express/Fastify service with TypeScript and Supabase client.
- Define environment configuration (`REACT_APP_*` where exposed to frontend) and secret handling.
- Implement schema validation middleware using shared canonical schema package.
