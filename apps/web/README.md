# Web App Workspace

Next.js 15 + React 19 client for ingestion, review, and export workflows.

## Planned Structure
- `app/` for App Router routes (upload, review, exports).
- `components/` for shared UI primitives using Radix UI + Tailwind CSS.
- `lib/` for Supabase client, TanStack Query config, and feature hooks.
- `tests/` for React Testing Library and Playwright component specs.

## Phase 1 Actions
- Initialize Next.js project with TypeScript and Tailwind CSS 4.
- Configure Supabase auth context and session management.
- Establish design tokens for light/dark themes and density toggle.
