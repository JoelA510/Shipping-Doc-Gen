# Shipping-Doc-Gen

Shipping documentation automation platform that converts diverse Commercial Invoices & Packing Lists (CIPL) into canonical shipment data and produces compliant SLI/BOL outputs.

## Monorepo Layout
- `apps/web` – Next.js 15 + React 19 client for upload, review, and export workflows.
- `apps/api` – Node.js 22 service orchestrating ingestion, canonical data management, and exports.
- `services/ocr` – Python 3.11 FastAPI microservice for OCR and document parsing.
- `packages/schemas` – Source of truth JSON Schemas (e.g., canonical shipment contract).
- `packages/shared` – Generated types and normalization/util packages shared across services.
- `docs` – Charter, architecture notes, and process guardrails.
- `infra` – Infrastructure-as-code and CI/CD automation scripts.

## Getting Started
1. Review the [project charter](docs/project-charter.md) for vision, scope, and success criteria.
2. Align on canonical data contracts within [`packages/schemas`](packages/schemas/README.md).
3. Use architecture guides under [`docs/architecture`](docs/architecture) to scaffold ingestion, exports, and security.

## Roadmap Alignment
This structure mirrors the roadmap phases:
- Phase 1 focuses on requirements, schema definition, and guardrails captured in `docs/` and `packages/schemas/`.
- Phase 2–4 build on the ingestion and OCR scaffolds defined in `apps/api` and `services/ocr`.
- Later phases leverage shared templates and exporters documented under `docs/architecture/output-generation.md`.
