---

# CIPL Standardizer and SLI/BOL Automation - Roadmap

A web app that ingests CIPL documents in many formats, normalizes them to a canonical JSON, validates against trade rules, and generates SLI and BOL outputs for multiple carriers. Modern UI, late 2025 standards.

## Table of Contents

* [Scope](#scope)
* [Stack at a Glance](#stack-at-a-glance)
* [Canonical Data Model](#canonical-data-model)
* [Phases](#phases)

  * [Phase 1 - Requirements and Schema](#phase-1---requirements-and-schema)
  * [Phase 2 - Ingestion and OCR Prototype](#phase-2---ingestion-and-ocr-prototype)
  * [Phase 3 - Full Ingestion Pipeline](#phase-3---full-ingestion-pipeline)
  * [Phase 4 - Extraction and Canonical Mapping](#phase-4---extraction-and-canonical-mapping)
  * [Phase 5 - Backend Infra and Security](#phase-5---backend-infra-and-security)
  * [Phase 6 - Frontend UI and UX](#phase-6---frontend-ui-and-ux)
  * [Phase 7 - SLI and BOL Generation](#phase-7---sli-and-bol-generation)
  * [Phase 8 - Accounts, Collaboration, History](#phase-8---accounts-collaboration-history)
  * [Phase 9 - QA and Testing](#phase-9---qa-and-testing)
  * [Phase 10 - Deployment and Launch](#phase-10---deployment-and-launch)
  * [Phase 11 - Enhancements and Maintenance](#phase-11---enhancements-and-maintenance)
* [Validation and Sanity Checks](#validation-and-sanity-checks)
* [Quick Checksum](#quick-checksum)

---

## Scope

* **Input at launch:** PDF native and scanned, DOCX, XLSX, CSV, JSON, XML, PNG, JPG, TIFF, .eml, .msg, ZIP batches, inbound JSON via REST.
* **Core:** OCR on scans and images. Canonical JSON as system of record. UI exports CSV, XLSX, and an inline Markdown table. Discrepancy checks with actionable fixes.
* **Outputs:** NCBFAA SLI v2020+, FedEx or DHL or UPS EEI helpers, NMFTA Straight BOL, VICS BOL, plus templates for CEVA, DB Schenker, Kuehne+Nagel, Nippon Express. IATA AWB and ocean B/L autofill where applicable.
* **UX flow:** Upload or email ingest → auto-parse → side-by-side review → validate → export.

---

## Stack at a Glance

* **Frontend:** React 19, Next.js 15 (App Router, Server Components), TypeScript, Tailwind CSS 4, Radix UI, TanStack Query. WCAG 2.2 AA. System dark or light. Density toggle.
* **Backend:** Node.js 22 API, Python 3.11 FastAPI for OCR and parsing. PostgreSQL 16. Object storage. Redis or SQS for queues. Playwright PDF rendering. pgvector for fuzzy matching.
* **ML and OCR:** Tesseract or PaddleOCR with language packs. pdfminer. Rules-first field extraction with ML assist. Confidence surfaced to UI.
* **Security:** SSO Google or Microsoft and optional Okta. Multi-tenant by org. Field-level encryption for PII. Audit logs. Backups and PITR.

---

## Canonical Data Model

**Header**

* shipment_id, created_at, source_filename, source_hash
* incoterms, terms_of_sale, currency, total_invoice_value_usd
* shipper {name, address, tax_id, contact}
* consignee {name, address, tax_id, contact}
* intermediate_consignee optional, notify_party optional
* export_date, export_reason, origin_country_overall
* transport_mode, carrier_preference, port_of_export, port_of_unloading
* license {type, number, expiry, ECCN[] optional}
* routing {freight_forwarder, account_numbers[]}
* totals {packages, qty, net_weight_kg, gross_weight_kg, cbm}

**Line item**

* line_id, part_number, description_long, df_flag D or F
* hts_code, schedule_b_code optional, eccn optional
* quantity {value, uom}
* unit_price_usd, extended_value_usd
* net_weight_kg, gross_weight_kg, country_of_origin
* marks_and_numbers optional, packaging {type, count}, metadata {images[], notes}

**Normalization and checks**

* Currency to USD via daily FX
* UOM to pieces and kg
* HTS format and country-specific length validation
* Header checksums for value, weight, quantity

**Exports**

* Inline Markdown: columns exactly D/F, HTS & SLI Appropriate Description, Quantity, Net Weight (kg), Value (USD). Group by HTS. Cents on USD. Append checksum row. After table, list part number and Country of Origin. Include HTS validation and alternates when invalid.

---

## Phases

### Phase 1 - Requirements and Schema

* Lock input matrix. Confirm OCR baseline. Define canonical JSON fully. Document normalization and validations. Finalize stack. Risk register for parsing edge cases.

### Phase 2 - Ingestion and OCR Prototype

* Simple upload spike for 1 file per type. OCR test on scanned PDF and TIFF. Structured text extraction for PDF, DOCX, XLSX, email. Identify layout markers from samples. Produce a minimal JSON demo. Record accuracy gaps.

### Phase 3 - Full Ingestion Pipeline

* Drag and drop upload with progress. ZIP fan-out. Queue jobs for background processing. Handlers for PDF native vs scanned, images to OCR, DOCX or XLSX readers, CSV or JSON or XML translators, email attachment harvest. Python OCR microservice. Persist interim raw text or HOCR. Robust error states.

### Phase 4 - Extraction and Canonical Mapping

* Rules-first parsers for header fields and line tables. Regex for dates, amounts, HTS, identifiers. Assemble canonical JSON. Normalize FX and UOM. Apply checksums and HTS format validation. Confidence scoring per field. Iterate on sample sets and add ML assist where rules fall short.

### Phase 5 - Backend Infra and Security

* PostgreSQL schema for shipments, line_items, parties, orgs, templates. Object storage for originals and outputs. REST API for upload, fetch, update, export. Background workers. SSO, RBAC stubs, org scoping. Immutable audit log. Backups and monitoring.

### Phase 6 - Frontend UI and UX

* Next.js 15 and React 19 with Tailwind and Radix. Upload UX with previews and client preflight. Review screen with side-by-side Original and Parsed. Inline edits. Confidence chips and highlights. Discrepancy banner with jump-to-field. Keyboard-first flows. Theming and brand hooks.

### Phase 7 - SLI and BOL Generation

* Template library for NCBFAA SLI, FedEx or DHL or UPS helpers, NMFTA Straight BOL, VICS BOL, CEVA or DB Schenker or Kuehne+Nagel or Nippon Express. Optional IATA AWB and ocean B/L. HTML to PDF via Playwright. CSV and XLSX and Markdown exports. Early template builder via JSON mappings.

### Phase 8 - Accounts, Collaboration, History

* Users and org workspaces. Roles: Admin, Preparer, Reviewer, ReadOnly. Versioned edits with diff. Inline comments and mentions. Approval workflow. Webhooks and outbound integrations. Denied party screening hook points.

### Phase 9 - QA and Testing

* Unit and integration tests for parsing and full upload-to-export. Cross-browser and responsive checks. Performance tests for large batches and long PDFs. Security tests for XSS, CSRF, SQLi, file sanitization. UAT with operators. Docs and in-app help.

### Phase 10 - Deployment and Launch

* Containerized services. CI or CD with staging gates. Secrets management. Seed reference data and templates. Monitoring and analytics for throughput and failures. Beta launch with real docs. GA after fixes.

### Phase 11 - Enhancements and Maintenance

* Improve OCR and ML extraction on trouble fields. Add carrier templates and API integrations. UX refinements and dashboarding. Performance tuning and scaling. Regulatory updates for Incoterms, EEI, and HTS. Live roadmap iteration.

---

## Validation and Sanity Checks

* `extended_value_usd` equals `quantity.value * unit_price_usd` per line to 2 decimals.
* Sum of line values equals header `total_invoice_value_usd`.
* Sum of line weights equals header totals.
* Sum of line quantities equals header `totals.qty`.
* HTS pattern check and country length rules.
* ECCN or license presence when license type is declared.
* Incoterms rules consistency with charges and terms.
* Export hash saved for PDFs. Reproducible exports from canonical JSON plus template version.

---

## Quick Checksum

* Phases: 11
* Inputs supported at launch: 12
* Core exports listed: 8 plus
* Accessibility target: WCAG 2.2 AA
* UI flow steps: 5

---