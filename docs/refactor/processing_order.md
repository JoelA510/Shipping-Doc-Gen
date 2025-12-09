# Refactoring Ticket Processing Order

This document lists the recommended order for processing the refactoring tickets. Security is prioritized first, followed by improvements that impact global stability and performance.

1.  **SEC-001** – **Secure File Uploads & ZIP Handling** (`docs/refactor/SEC-001_secure_uploads.md`) [COMPLETED]
    *   *Rationale:* Critical security vulnerability (Zip Slip/DoS) in a public-facing endpoint.
2.  **SEC-002** – **Secure Static File Serving** (`docs/refactor/SEC-002_secure_static_files.md`) [COMPLETED]
    *   *Rationale:* Exposure of sensitive user documents.
3.  **SEC-003** – **Enforce Real Authentication** (`docs/refactor/SEC-003_enforce_auth.md`)
    *   *Rationale:* Foundational security layer; needed before reliable RBAC or audit logging can be trusted.
4.  **PERF-001** – **Database Indexing** (`docs/refactor/PERF-001_db_indexing.md`)
    *   *Rationale:* High impact, low effort. Prevents technical debt accumulation as data grows.
5.  **ARCH-001** – **Async Job Queue** (`docs/refactor/ARCH-001_async_jobs.md`)
    *   *Rationale:* Structural change that improves stability for heavy loads (uploads/PDFs). Prerequisite for scaling PDF generation.
6.  **COST-001** – **PDF Generator Optimization** (`docs/refactor/COST-001_pdf_optimization.md`)
    *   *Rationale:* Significant resource reduction (RAM/CPU). Best done after or in conjunction with the job queue work.
7.  **COST-002** – **Carrier Rate Caching** (`docs/refactor/COST-002_rate_caching.md`)
    *   *Rationale:* Reduces latency and external API usage/costs.
8.  **ARCH-002** – **Structured Logging & Error Handling** (`docs/refactor/ARCH-002_structured_logging.md`)
    *   *Rationale:* Improves observability and debugging.
9.  **CODE-001** – **Refactor OCR Mapper & Shared Schemas** (`docs/refactor/CODE-001_ocr_refactor.md`)
    *   *Rationale:* Code cleanup and maintainability. Lower risk/impact than the above.
