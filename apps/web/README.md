# apps/web — frontend

Next.js 15 (App Router, React Server Components) + TypeScript + Tailwind + shadcn/ui. Deploys to Vercel.

> Status: not yet scaffolded. This README describes the intended structure.

## Three surfaces (App Router route groups)

| Route group | Audience | Auth | Rendering |
|---|---|---|---|
| `app/(public)/t/[slug]` | Spectators | none | ISR / CDN-cached + SSE for live data |
| `app/(console)/[org]/...` | Organizers, scorekeepers | required, org-scoped | RSC + client islands; WebSocket for live control |
| `app/(portal)/...` | Participants | required, personal scope | RSC |
| `app/(auth)/...` | Everyone | — | login, signup, accept-invite, magic-link |

## Key libraries (pins in `package.json`; rationale in `docs/STACK.md`)

TanStack Query (server state) · axios with `withCredentials: true` (cookie auth) · react-hook-form + zod (forms) · shadcn/ui + Tailwind 3.4 · lucide-react (icons) · sonner (toasts) · framer-motion · recharts (standings) · qrcode.react (QR) · date-fns.

## Conventions

- Package manager: **yarn** (workspaces). Never add `package-lock.json`. `@/` alias → `src/`.
- Data access through `packages/api-client` (generated from OpenAPI — never hand-write requests); wrap calls in TanStack Query hooks.
- Auth is cookie-based — axios `withCredentials: true`; no tokens in JS/localStorage.
- Single env `NEXT_PUBLIC_API_URL`; the client appends `/api/v1`.
- Forms validated with Zod; UI from `packages/ui` (shadcn).
- Mutations via Server Actions where ergonomic, otherwise the typed client.
- Realtime: `lib/realtime` hooks — WebSocket for the console, SSE for public pages.
- No business/sport logic in the frontend — it renders what the API computes.

## Env vars

See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) → frontend section (`NEXT_PUBLIC_*`).
