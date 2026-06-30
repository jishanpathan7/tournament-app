# packages — shared workspace packages

Reusable code shared across `apps/`. Managed by yarn workspaces + Turborepo.

> Status: not yet scaffolded. This README describes the intended packages.

| Package | Purpose | Notes |
|---|---|---|
| `api-client/` | TypeScript client + types | **Generated** from the API's OpenAPI schema in CI. Never hand-edit. |
| `ui/` | Shared design system | shadcn/ui components + Tailwind primitives consumed by `apps/web`. |
| `config/` | Shared config | eslint, tsconfig, tailwind preset — one source of truth. |
| `shared/` | TS-only utilities | Zod form schemas, shared helpers/constants used by the frontend. |

## Rules

- `api-client` is build output, not authored code — regenerated when the API contract changes, so frontend and backend never drift.
- No backend/Python code here (that lives in `apps/api`); no Python↔TS sharing except via the generated client.
- Keep packages small and dependency-light; app-specific logic belongs in `apps/`.
