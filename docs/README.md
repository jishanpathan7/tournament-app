# Documentation index

Start here. Read in this order depending on what you need.

## Understand the product
1. [Platform-Product-Spec.md](../Platform-Product-Spec.md) — vision, personas, user flows, features, information architecture, data model, permissions, MVP scope, roadmap.

## Understand the system
2. [Technical-Architecture.md](../Technical-Architecture.md) — folder structure, API architecture, database schema, authentication, authorization, realtime, public sharing, file uploads, notifications, QR codes, and the free-tier hosting plan (§15).
2a. [STACK.md](STACK.md) — the pinned tech stack: exact libraries/versions, what we kept and dropped from the "FastAPI + React SPA" blueprint, and the conventions carried over. Manifests: `apps/api/requirements.txt`, `apps/web/package.json`.

## Design the UI
3a. [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — the complete UI/UX design system in the "Candy Sticker" theme (color, typography, components, cards, tables, forms, empty/loading states, mobile, responsive, navigation/sidebar/topbar, the implementation kit, and the density-tier rule). Faithfully-themed screen mockups live in [mockups/](mockups/) — open the `.html` files in a browser.
3. [INTERFACES.md](INTERFACES.md) — the swappable infrastructure contracts (`PubSub`, `JobQueue`, `Cache`, `Storage`, `EmailChannel`, `AuthService`). This is the seam that lets us run free at MVP and upgrade to paid services without refactoring.

## Build features
3b. [../ENGINEERING_GUIDELINES.md](../ENGINEERING_GUIDELINES.md) — the engineering standard for all development (humans + AI): reuse-first rule, architecture, naming, components, API patterns, state, errors, logging, validation, TS, performance, security, testing, docs, git/PR, file organization, shared-vs-local, and the local dev workflow.

## Ship it
4. [DEPLOYMENT.md](DEPLOYMENT.md) — accounts to create, environment variables, deploy order for Vercel + Railway/Render + Neon + R2 + Resend, and when to upgrade each service.

## Run the first event
5. [Tournament-Playbook.md](../Tournament-Playbook.md) — how to actually organize the July badminton tournament (format, fairness engine, rules, logistics).
6. [SIBL-Badminton-2026-Workbook.xlsx](../SIBL-Badminton-2026-Workbook.xlsx) — live spreadsheet templates (check-in, fixtures, points tables, brackets) for event day.

## Working agreements
- [CLAUDE.md](../CLAUDE.md) — project context and conventions for contributors and AI sessions.

---

### Doc maintenance rules
- The two big specs (`Platform-Product-Spec.md`, `Technical-Architecture.md`) are **canonical**. When a decision changes, update them — don't fork the decision into a new doc.
- `CLAUDE.md` links out; it should never duplicate a spec's content.
- Keep this index current when adding a doc.
